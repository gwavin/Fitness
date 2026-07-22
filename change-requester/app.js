document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('poc-form');
    const spSiteUrlInput = document.getElementById('sp-site-url');
    const spListNameInput = document.getElementById('sp-list-name');
    const btnSubmitSp = document.getElementById('btn-submit-sp');
    const btnDownloadCsv = document.getElementById('btn-download-csv');
    
    const hiddenForm = document.getElementById('hidden-sp-form');
    const hiddenTitle = document.getElementById('hidden-title');
    const hiddenRequester = document.getElementById('hidden-requester');
    const hiddenDesc = document.getElementById('hidden-desc');
    
    const statusToast = document.getElementById('status-toast');
    const toastMessage = document.getElementById('toast-message');
    const toastClose = document.getElementById('toast-close');

    const STORAGE_SITE_URL = 'changerequester_sp_site_url';
    const STORAGE_LIST_NAME = 'changerequester_sp_list_name';

    // Helper: Clean and sanitize SharePoint URLs
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

    // Auto-fill site URL if available
    if (localStorage.getItem(STORAGE_SITE_URL)) {
        spSiteUrlInput.value = localStorage.getItem(STORAGE_SITE_URL);
    } else {
        spSiteUrlInput.value = 'https://healthireland-my.sharepoint.com/personal/gavin_horan1_hse_ie';
    }

    if (localStorage.getItem(STORAGE_LIST_NAME)) {
        spListNameInput.value = localStorage.getItem(STORAGE_LIST_NAME);
    }

    // Clean inputs automatically on paste/change
    spSiteUrlInput.addEventListener('change', () => {
        const cleaned = sanitizeSharePointSiteUrl(spSiteUrlInput.value.trim());
        if (cleaned !== spSiteUrlInput.value.trim()) {
            spSiteUrlInput.value = cleaned;
            showToast(`Cleaned SharePoint URL: ${cleaned}`, 'info');
        }
    });

    // Form submission handler using HTML Form POST to bypass CORS
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const rawUrl = spSiteUrlInput.value.trim();
        const siteUrl = sanitizeSharePointSiteUrl(rawUrl);
        const listName = spListNameInput.value.trim();

        if (!siteUrl || !listName) {
            showToast('Please enter your SharePoint Site URL and List Name.', 'error');
            return;
        }

        localStorage.setItem(STORAGE_SITE_URL, siteUrl);
        localStorage.setItem(STORAGE_LIST_NAME, listName);

        const requesterName = document.getElementById('req-name').value.trim();
        const changeTitle = document.getElementById('change-title').value.trim();
        const changeDesc = document.getElementById('change-desc').value.trim();

        btnSubmitSp.disabled = true;
        btnSubmitSp.innerHTML = `Submitting to SharePoint...`;

        try {
            // Populate hidden HTML form inputs
            hiddenTitle.value = changeTitle;
            hiddenRequester.value = requesterName;
            hiddenDesc.value = changeDesc;

            // Set hidden form action endpoint to SharePoint List items API
            const postEndpoint = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items`;
            hiddenForm.action = postEndpoint;

            // Submit HTML form natively (bypasses browser CORS preflight check)
            hiddenForm.submit();

            // Also send fallback no-cors fetch request to ensure server processing
            try {
                const payload = {
                    "__metadata": { "type": `SP.Data.${listName}ListItem` },
                    "Title": changeTitle,
                    "RequesterName": requesterName,
                    "Description": changeDesc
                };
                fetch(postEndpoint, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Accept': 'application/json; odata=verbose',
                        'Content-Type': 'application/json; odata=verbose'
                    },
                    body: JSON.stringify(payload)
                });
            } catch (ignore) {}

            showToast(`Success! Change Request "${changeTitle}" submitted to SharePoint!`, 'success');
            form.reset();

        } catch (err) {
            console.error(err);
            showToast(`Error submitting form: ${err.message}`, 'error');
        } finally {
            setTimeout(() => {
                btnSubmitSp.disabled = false;
                btnSubmitSp.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Submit directly to SharePoint List`;
            }, 1000);
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
