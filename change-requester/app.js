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

    // Auto-detect SharePoint site URL if hosted inside SharePoint
    if (window.location.origin.includes('sharepoint.com')) {
        // Extract current site web URL (e.g., https://tenant.sharepoint.com/sites/sitename)
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length >= 3 && pathParts[1] === 'sites') {
            spSiteUrlInput.value = `${window.location.origin}/${pathParts[1]}/${pathParts[2]}`;
        } else {
            spSiteUrlInput.value = window.location.origin;
        }
    } else if (localStorage.getItem(STORAGE_SITE_URL)) {
        spSiteUrlInput.value = localStorage.getItem(STORAGE_SITE_URL);
    }

    if (localStorage.getItem(STORAGE_LIST_NAME)) {
        spListNameInput.value = localStorage.getItem(STORAGE_LIST_NAME);
    }

    // Submit to SharePoint List via REST API
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let siteUrl = spSiteUrlInput.value.trim().replace(/\/+$/, '');
        const listName = spListNameInput.value.trim();

        if (!listName) {
            showToast('Please enter your SharePoint List Name.', 'error');
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
            // Determine base URL: if hosted on SharePoint, can use relative path or full URL
            const baseUrl = siteUrl ? siteUrl : '';

            // Step 1: Fetch Request Digest Token
            const contextUrl = `${baseUrl}/_api/contextinfo`;
            const contextRes = await fetch(contextUrl, {
                method: 'POST',
                headers: { 'Accept': 'application/json; odata=verbose' }
            });

            let requestDigest = '';
            if (contextRes.ok) {
                const contextData = await contextRes.json();
                requestDigest = contextData.d.GetContextWebInformation.FormDigestValue;
            }

            // Step 2: Post item to SharePoint List
            const postItemUrl = `${baseUrl}/_api/web/lists/getbytitle('${listName}')/items`;
            
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
                body: JSON.stringify(payload)
            });

            if (response.ok || response.status === 201) {
                showToast(`Success! Submitted "${changeTitle}" to SharePoint List "${listName}".`, 'success');
                form.reset();
            } else {
                const errText = await response.text();
                console.error('SharePoint API Error:', errText);
                showToast(`SharePoint returned status ${response.status}. Check column names in list.`, 'error');
            }

        } catch (err) {
            console.error(err);
            showToast(`CORS / Network error: ${err.message}. If running locally (file://), upload index.html directly into SharePoint Site Assets!`, 'error');
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
        setTimeout(() => statusToast.classList.add('hidden'), 6000);
    }

    toastClose.addEventListener('click', () => statusToast.classList.add('hidden'));
});
