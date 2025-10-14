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
    T('since_year').innerHTML = year;
    ajaxGet('https://clientapi.ipip.net/browser/myip', function(info) {
        if (info.ret === 0) {
            T('client_ip').innerHTML = info.data.client_ip + ' ' + info.data.location;
        } else {
            T('client_ip').innerHTML = info.msg;
        }
    });
};

var render = function(info) {
    T('show_ip').innerHTML = info.ip;
    T('location').innerHTML = info.country + " " + info.province + " " + info.city;
    T('isp').innerHTML = info.isp;
    T('asn').innerHTML = info.asn.join("<br/>");
    T('ports').innerHTML = info.ports.join(" ");
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
                dnsContainer.append('<dd><span>' + item.ip + '<span><span class="arrows glyphicon glyphicon-triangle-right"></span></dd>');
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
            T('browser_dns_ip').innerHTML = queryIp;
        }
        if (state.domain) {
            queryDomain = state.domain;
            T('domain').innerHTML = state.domain;
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
        var fip = $('#show_ip').html();
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

    new Fingerprint2().get(function(result, components) {
        $.post('https://www.ipip.net/fingerprint.php', {
            hash: result,
            components: components
        });
    });

    domain_view();

    new ClipboardJS('#copy');
};

function domain_view() {
    $('#domain_num').text(domainListCache.length);
    var ds = [];
    var dhtml = [];
    var sorted = domainListCache.slice().sort(function(a, b) {
        return b.amount - a.amount;
    });
    sorted.forEach(function(v) {
        ds.push(v.domain);
        dhtml.push('<dl class="dsl">');
        dhtml.push('<dt>' + v.domain + '</dt>');
        dhtml.push('<dd>' + v.amount + '</dd>');
        dhtml.push('</dl>');
    });
    $('#domains').html('<div>' + dhtml.join('') + '</div>');
    $('#copy').attr('data-clipboard-text', ds.join('\n'));
}

init();
