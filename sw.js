/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-15ec2ecc'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "offline.html",
    "revision": "9e820a797a6c7f5cd34a106890bd0752"
  }, {
    "url": "index.html",
    "revision": "11f33ae1f2d60e1fbd80e22f65f4583f"
  }, {
    "url": "404.html",
    "revision": "d0e9f9bdb9145562f5d9f35dca8b2840"
  }, {
    "url": "icons/shortcut-premium.png",
    "revision": "b09c6110f13b124731656faf4907ff86"
  }, {
    "url": "icons/shortcut-premium 2.png",
    "revision": "b09c6110f13b124731656faf4907ff86"
  }, {
    "url": "icons/shortcut-cours.png",
    "revision": "036f72fdc629a8c4b249dee583046d4a"
  }, {
    "url": "icons/shortcut-cours 2.png",
    "revision": "036f72fdc629a8c4b249dee583046d4a"
  }, {
    "url": "icons/icon-maskable-512x512.png",
    "revision": "5a38e9ed85d1462ffdc606ed65ade567"
  }, {
    "url": "icons/icon-maskable-512x512 2.png",
    "revision": "5a38e9ed85d1462ffdc606ed65ade567"
  }, {
    "url": "icons/icon-maskable-192x192.png",
    "revision": "d6abf6657b2f9d6f017b3f9e16f184da"
  }, {
    "url": "icons/icon-maskable-192x192 2.png",
    "revision": "d6abf6657b2f9d6f017b3f9e16f184da"
  }, {
    "url": "icons/icon-96x96.png",
    "revision": "d0521053300b27bac7c1407db3bf80a1"
  }, {
    "url": "icons/icon-96x96 2.png",
    "revision": "d0521053300b27bac7c1407db3bf80a1"
  }, {
    "url": "icons/icon-72x72.png",
    "revision": "3f2b317c57770d64e86b785238424dac"
  }, {
    "url": "icons/icon-72x72 2.png",
    "revision": "3f2b317c57770d64e86b785238424dac"
  }, {
    "url": "icons/icon-512x512.png",
    "revision": "b713a329b13c3615ac7d8d692b26ae89"
  }, {
    "url": "icons/icon-512x512 2.png",
    "revision": "b713a329b13c3615ac7d8d692b26ae89"
  }, {
    "url": "icons/icon-384x384.png",
    "revision": "cd0a912be884776ad4fbe49d276b138a"
  }, {
    "url": "icons/icon-384x384 2.png",
    "revision": "cd0a912be884776ad4fbe49d276b138a"
  }, {
    "url": "icons/icon-192x192.png",
    "revision": "d97875ece19755aed0da2e03e360114d"
  }, {
    "url": "icons/icon-192x192 2.png",
    "revision": "d97875ece19755aed0da2e03e360114d"
  }, {
    "url": "icons/icon-152x152.png",
    "revision": "c87ec122fa62d79c983adc97e6cd2041"
  }, {
    "url": "icons/icon-152x152 2.png",
    "revision": "c87ec122fa62d79c983adc97e6cd2041"
  }, {
    "url": "icons/icon-144x144.png",
    "revision": "70c0029c287638b73578da97c7010ca8"
  }, {
    "url": "icons/icon-144x144 2.png",
    "revision": "70c0029c287638b73578da97c7010ca8"
  }, {
    "url": "icons/icon-128x128.png",
    "revision": "ab372e2d14a330fc8d9762af4b6e2a93"
  }, {
    "url": "icons/icon-128x128 2.png",
    "revision": "ab372e2d14a330fc8d9762af4b6e2a93"
  }, {
    "url": "icons/favicon-32x32.png",
    "revision": "eda44b419b666fdad568e657d2403839"
  }, {
    "url": "icons/favicon-32x32 2.png",
    "revision": "eda44b419b666fdad568e657d2403839"
  }, {
    "url": "icons/favicon-16x16.png",
    "revision": "30cdd0bfba1e0c4066d0ead25307bb66"
  }, {
    "url": "icons/favicon-16x16 2.png",
    "revision": "30cdd0bfba1e0c4066d0ead25307bb66"
  }, {
    "url": "icons/apple-touch-icon.png",
    "revision": "55983e67645a8f9a7ae8edc6fcf801f0"
  }, {
    "url": "icons/apple-touch-icon 2.png",
    "revision": "55983e67645a8f9a7ae8edc6fcf801f0"
  }, {
    "url": "assets/vendor-react-BMsfgiGx.js",
    "revision": null
  }, {
    "url": "assets/vendor-icons-FUmECsCv.js",
    "revision": null
  }, {
    "url": "assets/vendor-firebase-LntcAirY.js",
    "revision": null
  }, {
    "url": "assets/index-DnnGO0b3.css",
    "revision": null
  }, {
    "url": "assets/index-DY8hUzTy.js",
    "revision": null
  }, {
    "url": "manifest.json",
    "revision": "5f97808cc1f465c6760e59790102a88b"
  }, {
    "url": "offline.html",
    "revision": "9e820a797a6c7f5cd34a106890bd0752"
  }, {
    "url": "icons/apple-touch-icon 2.png",
    "revision": "55983e67645a8f9a7ae8edc6fcf801f0"
  }, {
    "url": "icons/apple-touch-icon.png",
    "revision": "55983e67645a8f9a7ae8edc6fcf801f0"
  }, {
    "url": "icons/favicon-16x16 2.png",
    "revision": "30cdd0bfba1e0c4066d0ead25307bb66"
  }, {
    "url": "icons/favicon-16x16.png",
    "revision": "30cdd0bfba1e0c4066d0ead25307bb66"
  }, {
    "url": "icons/favicon-32x32 2.png",
    "revision": "eda44b419b666fdad568e657d2403839"
  }, {
    "url": "icons/favicon-32x32.png",
    "revision": "eda44b419b666fdad568e657d2403839"
  }, {
    "url": "icons/icon-128x128 2.png",
    "revision": "ab372e2d14a330fc8d9762af4b6e2a93"
  }, {
    "url": "icons/icon-128x128.png",
    "revision": "ab372e2d14a330fc8d9762af4b6e2a93"
  }, {
    "url": "icons/icon-144x144 2.png",
    "revision": "70c0029c287638b73578da97c7010ca8"
  }, {
    "url": "icons/icon-144x144.png",
    "revision": "70c0029c287638b73578da97c7010ca8"
  }, {
    "url": "icons/icon-152x152 2.png",
    "revision": "c87ec122fa62d79c983adc97e6cd2041"
  }, {
    "url": "icons/icon-152x152.png",
    "revision": "c87ec122fa62d79c983adc97e6cd2041"
  }, {
    "url": "icons/icon-192x192 2.png",
    "revision": "d97875ece19755aed0da2e03e360114d"
  }, {
    "url": "icons/icon-192x192.png",
    "revision": "d97875ece19755aed0da2e03e360114d"
  }, {
    "url": "icons/icon-384x384 2.png",
    "revision": "cd0a912be884776ad4fbe49d276b138a"
  }, {
    "url": "icons/icon-384x384.png",
    "revision": "cd0a912be884776ad4fbe49d276b138a"
  }, {
    "url": "icons/icon-512x512 2.png",
    "revision": "b713a329b13c3615ac7d8d692b26ae89"
  }, {
    "url": "icons/icon-512x512.png",
    "revision": "b713a329b13c3615ac7d8d692b26ae89"
  }, {
    "url": "icons/icon-72x72 2.png",
    "revision": "3f2b317c57770d64e86b785238424dac"
  }, {
    "url": "icons/icon-72x72.png",
    "revision": "3f2b317c57770d64e86b785238424dac"
  }, {
    "url": "icons/icon-96x96 2.png",
    "revision": "d0521053300b27bac7c1407db3bf80a1"
  }, {
    "url": "icons/icon-96x96.png",
    "revision": "d0521053300b27bac7c1407db3bf80a1"
  }, {
    "url": "icons/icon-maskable-192x192 2.png",
    "revision": "d6abf6657b2f9d6f017b3f9e16f184da"
  }, {
    "url": "icons/icon-maskable-192x192.png",
    "revision": "d6abf6657b2f9d6f017b3f9e16f184da"
  }, {
    "url": "icons/icon-maskable-512x512 2.png",
    "revision": "5a38e9ed85d1462ffdc606ed65ade567"
  }, {
    "url": "icons/icon-maskable-512x512.png",
    "revision": "5a38e9ed85d1462ffdc606ed65ade567"
  }, {
    "url": "icons/shortcut-cours 2.png",
    "revision": "036f72fdc629a8c4b249dee583046d4a"
  }, {
    "url": "icons/shortcut-cours.png",
    "revision": "036f72fdc629a8c4b249dee583046d4a"
  }, {
    "url": "icons/shortcut-premium 2.png",
    "revision": "b09c6110f13b124731656faf4907ff86"
  }, {
    "url": "icons/shortcut-premium.png",
    "revision": "b09c6110f13b124731656faf4907ff86"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/__(.*)/]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/firestore\.googleapis\.com\/.*/i, new workbox.NetworkFirst({
    "cacheName": "firestore-cache",
    "networkTimeoutSeconds": 5,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 604800
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/identitytoolkit\.googleapis\.com\/.*/i, new workbox.NetworkFirst({
    "cacheName": "firebase-auth-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 86400
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/.*\.railway\.app\/.*/i, new workbox.NetworkFirst({
    "cacheName": "railway-api-cache",
    "networkTimeoutSeconds": 10,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 86400
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/i, new workbox.StaleWhileRevalidate({
    "cacheName": "images-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 60,
      maxAgeSeconds: 2592000
    })]
  }), 'GET');

}));
//# sourceMappingURL=sw.js.map
