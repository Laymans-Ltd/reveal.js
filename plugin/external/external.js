/*
 * external.js
 * Original by Cal Evans <cal@calevans.com>
 * Enhanced with modern features while maintaining compatibility
 * Released under the MIT license
 */

const RevealExternal = {
    id: 'external',
    init: function(reveal) {
        // Configuration with defaults
        const config = {
            maxRetries: 3,
            retryDelay: 1000,
            timeout: 30000,
            cache: true,
            ...reveal.getConfig().external
        };

        // Cache for loaded content
        const contentCache = new Map();

        // Load all external content
        loadAllExternal();

        function loadAllExternal() {
            // Get all sections with external content
            const sections = document.querySelectorAll('[data-external]');
            if (!sections.length) return;

            // Create a loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'external-loading-indicator';
            loadingIndicator.style.cssText = `
                position: fixed;
                top: 1rem;
                right: 1rem;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 4px;
                font-size: 14px;
                z-index: 9999;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(loadingIndicator);

            // Track loading progress
            let loaded = 0;
            const updateProgress = () => {
                loaded++;
                loadingIndicator.textContent = `Loading external content: ${loaded}/${sections.length}`;
                if (loaded === sections.length) {
                    setTimeout(() => loadingIndicator.remove(), 500);
                }
            };

            // Process sections recursively until none remain
            async function processAllSections() {
                const sections = document.querySelectorAll('[data-external]');
                if (!sections.length) {
                    // All content loaded, initialize plugins once
                    console.log('All external content loaded, initializing plugins');
                    const plugins = reveal.getPlugins();
                    for (const [name, plugin] of Object.entries(plugins)) {
                        if (plugin.init) {
                            try {
                                plugin.init(reveal);
                            } catch (error) {
                                console.error(`Failed to initialize plugin ${name}:`, error);
                            }
                        }
                    }
                    return;
                }

                await Promise.all(
                    Array.from(sections).map(section => {
                        const url = section.getAttribute('data-external');
                        if (!url) return Promise.resolve();
                        
                        return loadExternalContent(section, url, config)
                            .then(() => {
                                section.removeAttribute('data-external');
                                section.setAttribute('fetched', '');
                                updateProgress();
                                reveal.sync();
                            })
                            .catch(error => {
                                console.error(`Failed to load external content ${url}:`, error);
                                section.remove();
                                updateProgress();
                            });
                    })
                );

                // Continue processing any new sections
                await processAllSections();
            }

            processAllSections();
        }

        async function loadExternalContent(section, url, config, retryCount = 0) {
            // Check cache first
            if (config.cache && contentCache.has(url)) {
                section.innerHTML = contentCache.get(url);
                return;
            }

            try {
                const response = await fetchWithTimeout(url, config.timeout);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const content = await response.text();
                
                // Cache the content
                if (config.cache) {
                    contentCache.set(url, content);
                }

                section.innerHTML = content;

            } catch (error) {
                // Retry logic
                if (retryCount < config.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, config.retryDelay));
                    return loadExternalContent(section, url, config, retryCount + 1);
                }
                throw error;
            }
        }

        function fetchWithTimeout(url, timeout) {
            return Promise.race([
                fetch(url),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), timeout)
                )
            ]);
        }


        // Expose API for manual content loading
        reveal.loadExternalContent = loadAllExternal;
    }
};

// Register plugin
if (typeof window.Reveal === 'undefined') {
    throw new Error('This plugin requires Reveal.js');
} else {
    window.RevealExternal = RevealExternal;
}