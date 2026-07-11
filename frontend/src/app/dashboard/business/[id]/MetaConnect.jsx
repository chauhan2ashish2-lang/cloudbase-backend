'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const SCOPES = 'pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,ads_management,business_management';

function loadFacebookSDK() {
  return new Promise((resolve) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = function () {
      window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: 'v19.0' });
      resolve(window.FB);
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  });
}

export default function MetaConnect({ businessId }) {
  const [status, setStatus] = useState(null); // null = loading, false = not connected, object = connected
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [pagePicker, setPagePicker] = useState(null); // { pages, userAccessToken, adAccounts }

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const res = await apiRequest(`/meta/businesses/${businessId}/status`);
      setStatus(res.data || false);
    } catch (err) {
      setStatus(false);
      setError(err.message);
    }
  }

  async function handleConnect() {
    setError('');
    if (!META_APP_ID) {
      setError('Meta App ID is not configured yet (NEXT_PUBLIC_META_APP_ID missing).');
      return;
    }
    setConnecting(true);
    try {
      const FB = await loadFacebookSDK();
      FB.login(
        async (response) => {
          if (response.authResponse?.accessToken) {
            try {
              const res = await apiRequest('/meta/oauth/exchange', {
                method: 'POST',
                body: { businessId, shortLivedToken: response.authResponse.accessToken },
              });
              setPagePicker(res);
            } catch (err) {
              setError(err.message);
            }
          } else {
            setError('Facebook login was cancelled or denied.');
          }
          setConnecting(false);
        },
        { scope: SCOPES }
      );
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  }

  async function selectPage(page) {
    setError('');
    setConnecting(true);
    try {
      await apiRequest('/meta/connect', {
        method: 'POST',
        body: {
          businessId,
          pageId: page.id,
          userAccessToken: pagePicker.userAccessToken,
          adAccountId: pagePicker.adAccounts?.[0]?.id || null,
        },
      });
      setPagePicker(null);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!status?.id) return;
    setConnecting(true);
    try {
      await apiRequest(`/meta/connections/${status.id}`, { method: 'DELETE' });
      setStatus(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="border border-neutral-800 rounded-xl p-5 mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-medium mb-1">Facebook & Instagram</div>
          {status === null && <div className="text-sm text-neutral-500">Checking connection…</div>}
          {status === false && <div className="text-sm text-neutral-500">Not connected yet.</div>}
          {status && (
            <div className="text-sm text-neutral-400">
              Connected: <span className="text-neutral-200">{status.fb_page_name}</span>
              {status.ig_username && <span> · @{status.ig_username}</span>}
            </div>
          )}
        </div>

        {status === false && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {connecting ? 'Connecting…' : 'Connect Facebook'}
          </button>
        )}
        {status && (
          <button
            onClick={disconnect}
            disabled={connecting}
            className="px-5 py-2.5 rounded-lg border border-neutral-800 hover:border-neutral-700 font-medium disabled:opacity-50"
          >
            Disconnect
          </button>
        )}
      </div>

      {error && <div className="text-sm text-red-400 mt-3">{error}</div>}

      {pagePicker && (
        <div className="mt-4 border-t border-neutral-800 pt-4">
          <div className="text-sm text-neutral-400 mb-2">Choose which Page to connect:</div>
          {pagePicker.pages.length === 0 ? (
            <div className="text-sm text-neutral-500">No manageable Pages found on this Facebook account.</div>
          ) : (
            <div className="space-y-2">
              {pagePicker.pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPage(p)}
                  disabled={connecting}
                  className="w-full text-left px-4 py-3 rounded-lg border border-neutral-800 hover:border-neutral-700 flex justify-between items-center disabled:opacity-50"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-neutral-500">{p.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
