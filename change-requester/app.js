document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('poc-form');
    const spSiteUrlInput = document.getElementById('sp-site-url');
    const spListNameInput = document.getElementById('sp-list-name');
    const btnSubmitSp = document.getElementById('btn-submit-sp');
    const btnDownloadCsv = document.getElementById('btn-download-csv');
    
    const statusToast = document.getElementById('status-toast');
    const toastMessage = document.getElementById('toast-message');
    const toastClose = document.getElementById('toast-close');

    // Local Storage Keys
    const STORAGE_SITE_URL = 'changerequester_sp_site_url';
    const STORAGE_LIST_NAME = 'changerequester_sp_list_name';

    // Helper: Clean and sanitize SharePoint URLs (handles sharing links like /:l:/r/personal/...)
    function sanitizeSharePointSiteUrl(rawUrl) {
        if (!rawUrl) return '';
        let clean = rawUrl.split('?')[0]; // remove query params like ?e=sB9k8I
        clean = clean.replace(/\/:[a-z]:\/r\//i, '/'); // remove /:l:/r/ sharing path segments
        const listsIdx = clean.indexOf('/Lists/');
        if (listsIdx !== -1) {
            clean = clean.substring(0, listsIdx); // strip /Lists/ChangeRequests part
        }
        return clean.replace(/\/+$/, '');
    }

    // Auto-detect or load saved URL
    if (localStorage.getItem(STORAGE_SITE_URL)) {
        spSiteUrlInput.value = localStorage.getItem(STORAGE_SITE_URL);
    } else if (document.referrer && document.referrer.includes('sharepoint.com')) {
        spSiteUrlInput.value = sanitizeSharePointSiteUrl(document.referrer);
    }

    if (localStorage.getItem(STORAGE_LIST_NAME)) {
        spListNameInput.value = localStorage.getItem(STORAGE_LIST_NAME);
    }

    // Live URL sanitization when user pastes a link
    spSiteUrlInput.addEventListener('change', () => {
        const cleaned = sanitizeSharePointSiteUrl(spSiteUrlInput.value.trim());
        if (cleaned !== spSiteUrlInput.value.trim()) {
            spSiteUrlInput.value = cleaned;
            showToast(`Sanitized SharePoint Site URL to: ${cleaned}`, 'info');
        }
    });

    // Submit to SharePoint List via REST API
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const rawUrl = spSiteUrlInput.value.trim();
        const siteUrl = sanitizeSharePointSiteUrl(rawUrl);
        const listName = spListNameInput.value.trim();

        if (!siteUrl || !listName) {
            showToast('Please enter your SharePoint Site URL and List Name.', 'error');
            return;
        }

        // Save preferences
        localStorage.setItem(STORAGE_SITE_URL, siteUrl);
        localStorage.setItem(STORAGE_LIST_NAME, listName);

        const requesterName = document.getElementById('req-name').value.trim();
        const changeTitle = document.getElementById('change-title').value.trim();
        const changeDesc = document.getElementById('change-desc').value.trim();

        // UI Loading state
        const originalText = btnSubmitSp.innerHTML;
        btnSubmitSp.disabled = true;
        btnSubmitSp.innerHTML = `Submitting to SharePoint...`;

        try {
            // Step 1: Fetch Request Digest Token
            const contextUrl = `${siteUrl}/_api/contextinfo`;
            let requestDigest = '';
            
            try {
                const contextRes = await fetch(contextUrl, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json; odata=verbose' },
                    credentials: 'include'
                });
                if (contextRes.ok) {
                    const contextData = await contextRes.json();
                    requestDigest = contextData.d.GetContextWebInformation.FormDigestValue;
                }
            } catch (err) {
                console.warn('ContextInfo fetch warning:', err);
            }

            // Step 2: Post item to SharePoint List
            const postItemUrl = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items`;
            
            const payload = {
                "__metadata": { "type": `SP.Data.${listName}ListItem` },
                "Title": changeTitle,
                "RequesterName": requesterName,
                "Description": changeDesc
            };

            const headers = {
                'Accept': 'application/json; odata=verbose',
                'Content-Type': 'application/json; odata=verbose'
            };

            if (requestDigest) {
                headers['X-RequestDigest'] = requestDigest;
            }

            const response = await fetch(postItemUrl, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok || response.status === 201) {
                showToast(`Success! Submitted "${changeTitle}" to SharePoint List "${listName}".`, 'success');
                form.reset();
            } else {
                const errText = await response.text();
                console.error('SharePoint API Error:', errText);
                showToast(`SharePoint returned status ${response.status}. Verify list column names.`, 'error');
            }

        } catch (err) {
            console.error(err);
            showToast(`CORS / Network Error: Browsers block cross-domain requests from github.io to sharepoint.com. Upload ChangeRequester.aspx directly to SharePoint Site Assets!`, 'error');
        } finally {
            btnSubmitSp.disabled = false;
            btnSubmitSp.innerHTML = originalText;
        }
    });

    // Backup Local CSV Download
    btnDownloadCsv.addEventListener('click', () => {
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const requesterName = document.getElementById('req-name').value.trim();
        const changeTitle = document.getElementById('change-title').value.trim();
        const changeDesc = document.getElementById('change-desc').value.trim();

        const csvContent = `Title,RequesterName,Description\n"${changeTitle.replace(/"/g, '""')}","${requesterName.replace(/"/g, '""')}","${changeDesc.replace(/"/g, '""')}"`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ChangeRequest_POC.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Local .CSV file downloaded.', 'success');
    });

    function showToast(msg, type = 'info') {
        toastMessage.textContent = msg;
        statusToast.className = `toast ${type}`;
        statusToast.classList.remove('hidden');
        setTimeout(() => statusToast.classList.add('hidden'), 7000);
    }

    toastClose.addEventListener('click', () => statusToast.classList.add('hidden'));
});
