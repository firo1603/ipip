if (window !== window.top) {
    return;
}

if (!/^https?:/.test(location.protocol)) {
    return;
}

var domains = {};

$('img').each(function(k, v){

    var match = v.src.match(/:?\/\/(.*?)\//);
    if (match) {
        if (psl.isValid(match[1])) {
            if (domains[match[1]]) {
                domains[match[1]] += 1;
            } else {
                domains[match[1]] = 1;
            }
        }
    }
});

$('a').each(function(k, v){
    var match = v.href.match(/:?\/\/(.*?)\//);
    if (match) {
        if (psl.isValid(match[1])) {
            if (domains[match[1]]) {
                domains[match[1]] += 1;
            } else {
                domains[match[1]] = 1;
            }
        }
    }
});

$('script').each(function(k, v){
    var match = v.src.match(/:?\/\/(.*?)\//);
    if (match) {
        if (psl.isValid(match[1])) {
            if (domains[match[1]]) {
                domains[match[1]] += 1;
            } else {
                domains[match[1]] = 1;
            }
        }
    }
});

$('link').each(function(k, v){
    var match = v.href.match(/:?\/\/(.*?)\//);
    if (match) {
        if (psl.isValid(match[1])) {
            if (domains[match[1]]) {
                domains[match[1]] += 1;
            } else {
                domains[match[1]] = 1;
            }
        }
    }
});
chrome.runtime.sendMessage({
    type: 'updateDomains',
    domains: domains,
    host: location.host
}, function() {
    const err = chrome.runtime.lastError;
    if (err) {
        console.debug('Failed to update domain list', err.message);
    }
});