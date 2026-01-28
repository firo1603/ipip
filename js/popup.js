var queryIp = '';
var queryDomain = '';
var refreshTimerId = 0;
var refreshCount = 0;
var maxRefresh = 3;
var activeTabId = 0;
var language = navigator.language;
var currentDnsEntries = [];
var domainListCache = [];

var ajaxGet = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onerror = function() {
        callback({
            ret: -1,
            msg: "Network Error"
        });
    };
    xhr.ontimeout = function() {
        callback({
            ret: -1,
            msg: "Request Timeout"
        });
    };
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            try {
                var resp = JSON.parse(xhr.responseText);
                callback(resp);
            } catch (e) {
                callback({
                    ret: 100,
                    msg: "Server Response Error"
                });
            }
        }
    };
    xhr.send();
};

var T = function(id) {
    return document.getElementById(id);
};

var getTabState = function(tabId) {
    return new Promise(function(resolve, reject) {
        chrome.runtime.sendMessage({
            type: 'getState',
            tabId: tabId
        }, function(response) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(response || {});
        });
    });
};

var refreshClientIP = function() {
    var year = new Date().getFullYear();
    if (year < 2019) {
        year = 2019;
    }
    T('since_year').textContent = year;
    ajaxGet('https://clientapi.ipip.net/browser/myip', function(info) {
        if (info.ret === 0) {
            T('client_ip').textContent = info.data.client_ip + ' ' + info.data.location;
        } else {
            T('client_ip').textContent = info.msg;
        }
    });
};

var render = function(info) {
    T('show_ip').textContent = info.ip;
    T('location').textContent = info.country + " " + info.province + " " + info.city;
    T('isp').textContent = info.isp;
    T('asn').textContent = info.asn.join(', ');
    T('ports').textContent = info.ports.join(' ');
};

var updateDnsPanel = function(activeIp, dnsList) {
    var dnsContainer = $('#dns');
    dnsContainer.find('dd:not(:first)').remove();
    var isv6 = false;
    if (Array.isArray(dnsList)) {
        dnsList.forEach(function(item) {
            if (!item || !item.ip) {
                return;
            }
            if (item.ip.indexOf(':') > -1) {
                isv6 = true;
            }
            if (item.ip !== activeIp) {
                var dd = document.createElement('dd');
                var spanIp = document.createElement('span');
                spanIp.textContent = item.ip;
                var arrow = document.createElement('span');
                arrow.className = 'arrows glyphicon glyphicon-triangle-right';
                dd.appendChild(spanIp);
                dd.appendChild(arrow);
                dnsContainer.append(dd);
            }
        });
    }
    if (!isv6) {
        T('layoutL').style.width = '25%';
        T('layoutR').style.width = '75%';
    } else {
        T('layoutL').style.width = '40%';
        T('layoutR').style.width = '60%';
    }
};

var requestTabReload = function(tabId) {
    chrome.runtime.sendMessage({
        type: 'reloadTab',
        tabId: tabId
    }, function() {
        if (chrome.runtime.lastError) {
            chrome.tabs.reload(tabId);
        }
    });
};

var refresh = async function() {
    if (!activeTabId) {
        return;
    }

    try {
        var state = await getTabState(activeTabId);

        domainListCache = Array.isArray(state.domainList) ? state.domainList : [];
        domain_view();

        if (state.ip) {
            queryIp = state.ip;
            T('browser_dns_ip').textContent = queryIp;
        }
        if (state.domain) {
            queryDomain = state.domain;
            T('domain').textContent = state.domain;
        }

        if (queryIp && queryDomain) {
            refreshCount = 0;

            currentDnsEntries = Array.isArray(state.dnsInfo) ? state.dnsInfo : [];
            updateDnsPanel(queryIp, currentDnsEntries);

            if (state.ipInfo) {
                if (refreshTimerId) {
                    clearInterval(refreshTimerId);
                    refreshTimerId = 0;
                }
                render(state.ipInfo);
            }
        } else if (refreshCount < maxRefresh) {
            refreshCount += 1;
            requestTabReload(activeTabId);
        }
    } catch (error) {
        console.error('Failed to refresh popup data', error);
    }
};

var init = function() {
    $('.ips').delegate('dd', 'click', function() {
        var ip = $(this).text();
        if (ip.indexOf('.') === -1 && ip.indexOf(':') === -1) {
            $('#layoutR').hide();
            $('#layoutR2').show();
            $('.ips dd').removeClass('active');
            $(this).addClass('active');
            return;
        }

        $('#layoutR').show();
        $('#layoutR2').hide();

        if (currentDnsEntries.length > 0) {
            $('.ips dd').removeClass('active');
            $(this).addClass('active');
            currentDnsEntries.forEach(function(entry) {
                if (entry.ip === ip) {
                    render(entry);
                }
            });
        }
    });

    refreshClientIP();

    chrome.tabs.query({
        active: true,
        windowId: chrome.windows.WINDOW_ID_CURRENT
    }, function(tabs) {
        if (tabs.length === 0) {
            console.warn('No active tab found');
            return;
        }

        activeTabId = tabs[0].id;
        var titleMessage = language.indexOf('CN') > -1 ? '网站IP数据信息 Powered by IPIP.net' : 'WebSite IP Information query Powered by IPIP.net';
        chrome.action.setTitle({
            tabId: activeTabId,
            title: titleMessage
        }, function() {
            if (chrome.runtime.lastError) {
                console.debug('Failed to set action title', chrome.runtime.lastError.message);
            }
        });

        refreshTimerId = setInterval(function() {
            refresh().catch(function(err) {
                console.error(err);
            });
        }, 500);

        refresh();
    });

    T('to_ipip').onclick = function() {
        var fip = $('#show_ip').text();
        chrome.tabs.create({
            url: 'https://www.ipip.net/ip/' + fip + '.html',
            selected: false
        });
        return false;
    };

    $('#copyright').on('click', function() {
        chrome.tabs.create({
            url: 'https://www.ipip.net/ip.html',
            selected: true
        });
    });

    $('#privacy').on('click', function() {
        chrome.tabs.create({
            url: this.href,
            selected: true
        });
    });

    domain_view();

    new ClipboardJS('#copy');
};

function domain_view() {
    $('#domain_num').text(domainListCache.length);
    var ds = [];
    var sorted = domainListCache.slice().sort(function(a, b) {
        return b.amount - a.amount;
    });
    var wrapper = document.createElement('div');
    sorted.forEach(function(v) {
        ds.push(v.domain);
        var dl = document.createElement('dl');
        dl.className = 'dsl';
        var dt = document.createElement('dt');
        dt.textContent = v.domain;
        var dd = document.createElement('dd');
        dd.textContent = v.amount;
        dl.appendChild(dt);
        dl.appendChild(dd);
        wrapper.appendChild(dl);
    });
    $('#domains').empty().append(wrapper);
    $('#copy').attr('data-clipboard-text', ds.join('\n'));
}

init();
