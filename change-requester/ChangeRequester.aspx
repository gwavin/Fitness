<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ChangeRequester | SharePoint POC</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --font-heading: 'Outfit', sans-serif;
            --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            
            --bg-main: #0B0F19;
            --bg-card: rgba(23, 31, 49, 0.85);
            --bg-card-border: rgba(255, 255, 255, 0.1);
            --bg-input: rgba(13, 19, 33, 0.9);
            
            --accent-primary: #6366F1;
            --accent-primary-hover: #4F46E5;
            --accent-success: #10B981;
            --accent-success-hover: #059669;
            --accent-info: #3B82F6;
            --accent-danger: #EF4444;

            --text-primary: #F3F4F6;
            --text-secondary: #9CA3AF;
            --text-muted: #6B7280;

            --radius-sm: 6px;
            --radius-md: 12px;
            --radius-lg: 18px;

            --shadow-glow: 0 0 25px rgba(99, 102, 241, 0.15);
            --transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: var(--font-body);
            background-color: var(--bg-main);
            background-image: 
                radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.1) 0px, transparent 50%);
            background-attachment: fixed;
            color: var(--text-primary);
            min-height: 100vh;
            padding: 2rem 1rem;
            display: flex;
            justify-content: center;
        }

        .app-container {
            width: 100%;
            max-width: 850px;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .app-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
        }

        .logo-area { display: flex; align-items: center; gap: 1rem; }

        .logo-icon {
            width: 46px;
            height: 46px;
            border-radius: var(--radius-md);
            background: linear-gradient(135deg, var(--accent-primary), #8B5CF6);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFF;
            box-shadow: var(--shadow-glow);
        }

        h1 {
            font-family: var(--font-heading);
            font-size: 1.75rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            background: linear-gradient(to right, #FFFFFF, #9CA3AF);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtitle { font-size: 0.875rem; color: var(--text-secondary); }

        .card {
            background: var(--bg-card);
            backdrop-filter: blur(12px);
            border: 1px solid var(--bg-card-border);
            border-radius: var(--radius-lg);
            padding: 1.75rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }

        .card-header { margin-bottom: 1.25rem; }
        .card-header h2 { font-family: var(--font-heading); font-size: 1.25rem; font-weight: 600; }
        .card-header p { font-size: 0.875rem; color: var(--text-secondary); }

        .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
        .full-width { grid-column: span 2; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }

        label { font-size: 0.825rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
        .required { color: var(--accent-danger); }

        input, textarea {
            font-family: var(--font-body);
            font-size: 0.95rem;
            background: var(--bg-input);
            border: 1px solid var(--bg-card-border);
            border-radius: var(--radius-sm);
            padding: 0.65rem 0.85rem;
            color: var(--text-primary);
            outline: none;
            transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        input:focus, textarea:focus {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .help-text { font-size: 0.775rem; color: var(--text-muted); }

        .form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            margin-top: 1.5rem;
            padding-top: 1.25rem;
            border-top: 1px solid var(--bg-card-border);
        }

        button {
            font-family: var(--font-body);
            font-size: 0.875rem;
            font-weight: 600;
            border-radius: var(--radius-sm);
            padding: 0.65rem 1.15rem;
            border: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all var(--transition-fast);
        }

        .btn-primary { background-color: var(--accent-primary); color: #FFF; }
        .btn-primary:hover { background-color: var(--accent-primary-hover); }

        .btn-success { background-color: var(--accent-success); color: #FFF; }
        .btn-success:hover { background-color: var(--accent-success-hover); }

        .badge { font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 999px; text-transform: uppercase; }
        .badge-info { background: rgba(59, 130, 246, 0.2); color: #60A5FA; }

        .toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: #1E293B;
            border: 1px solid var(--bg-card-border);
            border-radius: var(--radius-md);
            padding: 1rem 1.25rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            z-index: 100;
            max-width: 450px;
        }

        .toast.success { border-left: 4px solid var(--accent-success); }
        .toast.error { border-left: 4px solid var(--accent-danger); }
        .hidden { display: none !important; }

        #toast-close { background: none; border: none; font-size: 1.25rem; color: var(--text-secondary); margin-left: auto; }
    </style>
</head>
<body>
    <div class="app-container">
        <header class="app-header">
            <div class="logo-area">
                <div class="logo-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <div>
                    <h1>ChangeRequester POC</h1>
                    <p class="subtitle">No-Premium License | Native SharePoint Integration</p>
                </div>
            </div>
        </header>

        <section class="card config-card">
            <div class="card-header">
                <h2>SharePoint Settings</h2>
                <span class="badge badge-info">Auto-Configured</span>
            </div>
            <div class="form-grid">
                <div class="form-group full-width">
                    <label for="sp-list-name">SharePoint List Name <span class="required">*</span></label>
                    <input type="text" id="sp-list-name" value="ChangeRequests" placeholder="e.g. ChangeRequests">
                    <small class="help-text">The exact name of the list created in your SharePoint site.</small>
                </div>
            </div>
        </section>

        <div id="status-toast" class="toast hidden">
            <span id="toast-message"></span>
            <button id="toast-close" type="button">&times;</button>
        </div>

        <main class="main-content">
            <section class="card form-card">
                <div class="card-header">
                    <h2>Submit Change Request</h2>
                    <p>Fills single entry into your SharePoint List, triggering CSV generation.</p>
                </div>

                <form id="poc-form">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="req-name">Requester Name <span class="required">*</span></label>
                            <input type="text" id="req-name" required placeholder="e.g. Gavin Horan">
                        </div>

                        <div class="form-group">
                            <label for="change-title">Change Title <span class="required">*</span></label>
                            <input type="text" id="change-title" required placeholder="e.g. Server Maintenance Upgrade">
                        </div>

                        <div class="form-group full-width">
                            <label for="change-desc">Change Description <span class="required">*</span></label>
                            <textarea id="change-desc" rows="3" required placeholder="Brief description of the change..."></textarea>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" id="btn-submit-sp" class="btn-success">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            Submit directly to SharePoint List
                        </button>
                        <button type="button" id="btn-download-csv" class="btn-primary">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Download Local .CSV Backup
                        </button>
                    </div>
                </form>
            </section>
        </main>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const form = document.getElementById('poc-form');
            const spListNameInput = document.getElementById('sp-list-name');
            const btnSubmitSp = document.getElementById('btn-submit-sp');
            const btnDownloadCsv = document.getElementById('btn-download-csv');
            const statusToast = document.getElementById('status-toast');
            const toastMessage = document.getElementById('toast-message');
            const toastClose = document.getElementById('toast-close');

            // Detect current SharePoint web URL automatically from page context
            function getWebUrl() {
                if (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo.webAbsoluteUrl) {
                    return _spPageContextInfo.webAbsoluteUrl;
                }
                const parts = window.location.pathname.split('/');
                const sitesIdx = parts.indexOf('sites');
                if (sitesIdx !== -1 && parts[sitesIdx + 1]) {
                    return `${window.location.origin}/sites/${parts[sitesIdx + 1]}`;
                }
                return window.location.origin;
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const listName = spListNameInput.value.trim();
                if (!listName) {
                    showToast('Please enter your SharePoint List Name.', 'error');
                    return;
                }

                const siteUrl = getWebUrl();
                const requesterName = document.getElementById('req-name').value.trim();
                const changeTitle = document.getElementById('change-title').value.trim();
                const changeDesc = document.getElementById('change-desc').value.trim();

                btnSubmitSp.disabled = true;
                btnSubmitSp.innerHTML = `Submitting to SharePoint...`;

                try {
                    // Fetch FormDigestToken for SharePoint POST operations
                    let requestDigest = '';
                    try {
                        const contextRes = await fetch(`${siteUrl}/_api/contextinfo`, {
                            method: 'POST',
                            headers: { 'Accept': 'application/json; odata=verbose' }
                        });
                        if (contextRes.ok) {
                            const data = await contextRes.json();
                            requestDigest = data.d.GetContextWebInformation.FormDigestValue;
                        }
                    } catch(e) { console.log('ContextInfo fallback'); }

                    // Post Item to SharePoint List
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
                        body: JSON.stringify(payload)
                    });

                    if (response.ok || response.status === 201) {
                        showToast(`Success! Created entry "${changeTitle}" in list "${listName}".`, 'success');
                        form.reset();
                    } else {
                        const errText = await response.text();
                        console.error('SharePoint API Error:', errText);
                        showToast(`SharePoint returned status ${response.status}. Verify column names in list.`, 'error');
                    }

                } catch (err) {
                    console.error(err);
                    showToast(`Error: ${err.message}`, 'error');
                } finally {
                    btnSubmitSp.disabled = false;
                    btnSubmitSp.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Submit directly to SharePoint List`;
                }
            });

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
    </script>
</body>
</html>
