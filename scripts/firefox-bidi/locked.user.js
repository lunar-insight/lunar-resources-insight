// Firefox prefs for opening the app at localhost:5173: pages cannot reach any
// address other than localhost. Used by drive.mjs and by the lunar-dev profile.

// Every request except to localhost goes to a closed port.
user_pref("network.proxy.type", 1);
user_pref("network.proxy.http", "127.0.0.1");
user_pref("network.proxy.http_port", 9);
user_pref("network.proxy.ssl", "127.0.0.1");
user_pref("network.proxy.ssl_port", 9);
user_pref("network.proxy.share_proxy_settings", true);
user_pref("network.proxy.no_proxies_on", "localhost, 127.0.0.1");

// Channels that bypass the proxy or resolve names directly.
user_pref("media.peerconnection.enabled", false);
user_pref("network.dns.disablePrefetch", true);
user_pref("network.prefetch-next", false);
user_pref("network.http.speculative-parallel-limit", 0);
user_pref("network.trr.mode", 5);
