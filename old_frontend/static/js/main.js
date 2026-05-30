$(document).ready(function () {
    init();
});

function init() {
    updateTimeEverySecond();
    initializeAutocomplete();
    initializeChart();
    loadDataAndInitialize();
    initializePredictionButton();
    updateSiteStats();
}

function updateSiteStats() {
    $.get('/site_stats', function(data) {
        $('#site-visit-count').text(data.visit_count);
        $('#site-visitor-count').text(data.visitor_count);
    });
}

function updateTimeEverySecond() {
    function updateTime() {
        const now = new Date();
        const formattedTime = now.toLocaleString();
        $('#current-time').text(formattedTime);
    }
    setInterval(updateTime, 1000);
    updateTime();
}

function loadDataAndInitialize() {
    Promise.all([
        loadData("/query_hero"),
        loadData("/query_win_rate"),
        loadData("/query_team")
    ]).then(([heroes, winRates, teams]) => {
        window.hero_list = heroes;
        window.hero_win_rate = winRates.data;
        window.team_list = teams;
        restoreFormState();
        initAutocomplete();
    }).catch(error => {
        console.error('加载数据失败:', error);
    });
}

function loadData(url) {
    return $.getJSON(url).fail((jqXHR, textStatus, errorThrown) => {
        console.error(`加载数据失败: ${textStatus}, ${errorThrown}`);
    });
}

function initializeAutocomplete() {
    $(".hero-input, .team-name-input").on("input", function () {
        const $this = $(this);
        if ($this.val()) {
            triggerAutocomplete($this);
        }
        fetchDataAndUpdateChart();
        saveFormState();
    });
}

function triggerAutocomplete(inputElement) {
    debounce(function () {
        if (inputElement && inputElement.val()) {
            const query = inputElement.val();
            if (query.length >= 1 && !inputElement.data('autocompleting')) {
                const dataType = inputElement.hasClass('hero-input') ? 'hero' : 'team';
                const autocompleteSource = generateAutocompleteSource(dataType, query);
                inputElement.autocomplete("option", "source", autocompleteSource).autocomplete("search", query);
            }
        }
    }, 300);
}

function generateAutocompleteSource(dataType, query) {
    let source = [];
    try {
        if (dataType === 'hero') {
            const fuse = new Fuse(window.hero_list, {
                keys: ['name', 'keywords'],
                threshold: 0.3
            });
            source = fuse.search(query).map(result => ({
                label: result.item.name,
                value: result.item.name,
                id: result.item.heroId,
                logo: result.item.heroLogo
            }));
        } else if (dataType === 'team') {
            const teamsArray = Array.isArray(window.team_list) ? window.team_list : Object.values(window.team_list);
            const fuse = new Fuse(teamsArray, {
                keys: ['teamName', 'teamShortName'],
                threshold: 0.3
            });
            source = fuse.search(query).map(result => ({
                label: result.item.teamName,
                value: result.item.teamName,
                id: result.item.teamId,
                logo: result.item.teamLogo
            }));
        }
    } catch (error) {
        console.error('生成自动补全数据源时出错:', error);
    }
    return source;
}

function debounce(func, wait) {
    let timeout;
    return function () {
        clearTimeout(timeout);
        timeout = setTimeout(func, wait);
    };
}

function initAutocomplete() {
    $(".hero-input, .team-name-input").each(function () {
        const $this = $(this);
        const dataType = $this.hasClass('hero-input') ? 'hero' : 'team';

        $this.autocomplete({
            source: function (request, response) {
                const query = request.term;
                if (query.length >= 1) {
                    const source = generateAutocompleteSource(dataType, query);
                    response(source);
                }
            },
            select: function (event, ui) {
                $this.val(ui.item.label);
                if ($this.hasClass('hero-input')) {
                    $this.data('hero-id', ui.item.id);
                    $this.attr('value', ui.item.id);
                } else {
                    $this.data('team-id', ui.item.id);
                }
                $this.css('background-image', `url(${ui.item.logo})`);
                $this.css('background-repeat', 'no-repeat');
                $this.css('background-position', 'right 10px center');
                $this.css('background-size', '30px 30px');
                fetchDataAndUpdateChart();
                saveFormState();
                return false;
            },
            open: function () {
                $this.data('autocompleting', true);
            },
            close: function () {
                $this.data('autocompleting', false);
            }
        }).autocomplete("instance")._renderItem = function (ul, item) {
            return $("<li>")
                .append(`<div style="display: flex; justify-content: space-between; align-items: center;">${item.label}<img src="${item.logo}" alt="logo" style="width:30px; height:30px; margin-left:10px;"></div>`)
                .appendTo(ul);
        };
    });
}

function initializeChart() {
    window.myChart = echarts.init(document.getElementById('win-rate-chart'));
    const option = {
        title: {
            text: '英雄胜率对比图',
            left: 'center',
            top: 20,
            textStyle: {
                fontSize: 20,
                fontWeight: 'bold',
                fontFamily: '宋体',
                color: '#333'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function (params) {
                var result = params[0].name + '<br/>';
                params.forEach(function (item) {
                    result += item.marker + " " + item.seriesName + ": " + (item.value).toFixed(2) + "%<br/>";
                });
                return result;
            },
            textStyle: {
                fontFamily: 'Times New Roman',
                fontSize: 14,
                color: '#000'
            }
        },
        xAxis: {
            type: 'category',
            data: ['TOP', 'JUN', 'MID', 'ADC', 'SUP'],
            axisLabel: {
                textStyle: {
                    fontFamily: 'Cambria Math',
                    fontSize: 17,
                    color: '#333'
                }
            }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 70,
            axisLabel: {
                formatter: '{value} %',
                textStyle: {
                    fontFamily: 'Cambria Math',
                    fontSize: 15,
                    color: '#333'
                }
            },
            splitLine: {
                show: false
            }
        },
        series: [
            {
                name: 'A队',
                type: 'bar',
                data: [],
                itemStyle: {
                    color: '#5470C6'
                },
                label: {
                    show: true,
                    position: 'top',
                    formatter: function (params) {
                        return params.value.toFixed(2) + "%";
                    },
                    textStyle: {
                        fontFamily: 'Cambria Math',
                        fontSize: 14,
                        color: '#333'
                    }
                }
            },
            {
                name: 'B队',
                type: 'bar',
                data: [],
                itemStyle: {
                    color: '#91CC75'
                },
                label: {
                    show: true,
                    position: 'top',
                    formatter: function (params) {
                        return params.value.toFixed(2) + "%";
                    },
                    textStyle: {
                        fontFamily: 'Cambria Math',
                        fontSize: 14,
                        color: '#333'
                    }
                }
            }
        ]
    };
    window.myChart.setOption(option);
}

function updateChart(data) {
    const leftHeroIds = $('#left-team .hero-input').map(function () {
        return $(this).data('hero-id') || 0;
    }).get();

    const rightHeroIds = $('#right-team .hero-input').map(function () {
        return $(this).data('hero-id') || 0;
    }).get();

    const leftWinRates = [];
    const rightWinRates = [];
    const positions = ['top', 'jun', 'mid', 'adc', 'sup'];

    leftHeroIds.forEach(function (heroId, index) {
        if (heroId && data[heroId]) {
            const position = positions[index % 5];
            leftWinRates.push(data[heroId][position] * 100).toFixed(2);
        } else {
            leftWinRates.push(0);
        }
    });

    rightHeroIds.forEach(function (heroId, index) {
        if (heroId && data[heroId]) {
            const position = positions[index % 5];
            rightWinRates.push(data[heroId][position] * 100).toFixed(2);
        } else {
            rightWinRates.push(0);
        }
    });

    window.myChart.setOption({
        series: [
            {
                name: 'A队',
                data: leftWinRates.map(rate => parseFloat(rate))
            },
            {
                name: 'B队',
                data: rightWinRates.map(rate => parseFloat(rate))
            }
        ]
    });
}

function fetchDataAndUpdateChart() {
    $.getJSON('/get_echarts_data', function (data) {
        updateChart(data);
    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.error(`加载数据失败: ${textStatus}, ${errorThrown}`);
    });
}

function initializePredictionButton() {
    $("#predict-btn").on("click", function () {
        const leftTeamData = getTeamData("#left-team", $("#left-team-name").data('team-id'), 'A');
        const rightTeamData = getTeamData("#right-team", $("#right-team-name").data('team-id'), 'B');
        if (leftTeamData.length < 5 || rightTeamData.length < 5) {
            alert("请确保每队选择五个英雄");
            return;
        }

        const requestData = {
            left_team: leftTeamData,
            right_team: rightTeamData
        };

        $.ajax({
            type: "POST",
            url: "/predict",
            contentType: "application/json",
            data: JSON.stringify(requestData),
            success: function (response) {
                $("#A-win-rate").text(formatWinRate(response.A_win));
                $("#B-win-rate").text(formatWinRate(response.B_win));
                $("#winning-team-name").text(response.winning_team.name);
                $("#winning-team-logo").attr("src", response.winning_team.logo).show();
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.error(`预测请求失败: ${textStatus}, ${errorThrown}`);
                alert("预测请求失败，请稍后重试");
            }
        });
    });
}

function getTeamData(teamSelector, teamId, teamPrefix) {
    const teamData = {[`team${teamPrefix}id`]: Number(teamId)};
    $(teamSelector + " .hero-input").each(function (index) {
        const role = $(this).data("role");
        const roleIndex = getRoleIndex(role);
        const heroName = $(this).val().trim().toLowerCase();
        if (heroName) {
            const hero = window.hero_list.find(h =>
                h.name.toLowerCase() === heroName ||
                h.keywords.split(',').map(k => k.toLowerCase()).includes(heroName)
            );
            if (hero) {
                const heroId = hero.heroId;
                const winRate = getHeroWinRate(heroId, role);
                teamData[`${teamPrefix}${index + 1}playerLocation`] = roleIndex;
                teamData[`${teamPrefix}${index + 1}heroId`] = Number(heroId);
                teamData[`${teamPrefix}${index + 1}heroWinRate`] = winRate;
            } else {
                console.error(`无法找到英雄: ${heroName}`);
                teamData[`${teamPrefix}${index + 1}playerLocation`] = roleIndex;
                teamData[`${teamPrefix}${index + 1}heroId`] = null;
                teamData[`${teamPrefix}${index + 1}heroWinRate`] = 0.5;
            }
        }
    });
    return teamData;
}

function getRoleIndex(role) {
    role = role.toUpperCase();
    switch (role) {
        case 'TOP':
            return 0;
        case 'JUNGLE':
        case 'JUN':
            return 1;
        case 'MID':
        case 'MIDDLE':
            return 2;
        case 'ADC':
        case 'BOT':
        case 'BOTTOM':
            return 3;
        case 'SUP':
        case 'SUPPORT':
            return 4;
        default:
            return 99;
    }
}

function getHeroWinRate(heroId, role) {
    const positionMap = {
        0: ['TOP'],
        1: ['JUNGLE', 'JUN'],
        2: ['MID', 'MIDDLE'],
        3: ['ADC', 'BOT', 'BOTTOM'],
        4: ['SUPPORT', 'SUP']
    };

    let positionName;
    for (const [key, values] of Object.entries(positionMap)) {
        if (values.includes(role.toUpperCase())) {
            positionName = values[0];
            break;
        }
    }

    if (!positionName) {
        console.error(`未知的角色位置: ${role}`);
        return 0.5;
    }

    const heroData = window.hero_win_rate.find(h =>
        String(h.champion_id) == String(heroId) &&
        h.positionName && h.positionName.toUpperCase() === positionName.toUpperCase()
    );
    if (heroData && heroData.positionWinRate) {
        return parseFloat(heroData.positionWinRate) / 100;
    }
    return 0.5;
}

function saveFormState() {
    const state = {
        leftTeamName: $('#left-team-name').val(),
        rightTeamName: $('#right-team-name').val(),
        leftTeamId: $('#left-team-name').data('team-id'),
        rightTeamId: $('#right-team-name').data('team-id'),
        leftHeroes: [],
        rightHeroes: []
    };
    $('#left-team .hero-input').each(function () {
        state.leftHeroes.push({
            value: $(this).val(),
            id: $(this).data('hero-id') || null
        });
    });
    $('#right-team .hero-input').each(function () {
        state.rightHeroes.push({
            value: $(this).val(),
            id: $(this).data('hero-id') || null
        });
    });
    localStorage.setItem('lol_form_state', JSON.stringify(state));
}

function restoreFormState() {
    const stateStr = localStorage.getItem('lol_form_state');
    if (!stateStr) return;
    try {
        const state = JSON.parse(stateStr);
        $('#left-team-name').val(state.leftTeamName || '').data('team-id', state.leftTeamId || '');
        $('#right-team-name').val(state.rightTeamName || '').data('team-id', state.rightTeamId || '');
        $('#left-team .hero-input').each(function (i) {
            if (state.leftHeroes && state.leftHeroes[i]) {
                $(this).val(state.leftHeroes[i].value || '').data('hero-id', state.leftHeroes[i].id || '');
            }
        });
        $('#right-team .hero-input').each(function (i) {
            if (state.rightHeroes && state.rightHeroes[i]) {
                $(this).val(state.rightHeroes[i].value || '').data('hero-id', state.rightHeroes[i].id || '');
            }
        });
        // 恢复队伍logo
        ['#left-team-name', '#right-team-name'].forEach(function(selector) {
            const $input = $(selector);
            const teamName = $input.val();
            if (teamName && window.team_list) {
                const team = (Array.isArray(window.team_list) ? window.team_list : Object.values(window.team_list))
                    .find(t => t.teamName === teamName);
                if (team && team.teamLogo) {
                    $input.css('background-image', `url(${team.teamLogo})`);
                    $input.css('background-repeat', 'no-repeat');
                    $input.css('background-position', 'right 10px center');
                    $input.css('background-size', '30px 30px');
                }
            }
        });
        // 恢复英雄logo
        $('#left-team .hero-input, #right-team .hero-input').each(function () {
            const $input = $(this);
            const heroName = $input.val();
            if (heroName && window.hero_list) {
                const hero = window.hero_list.find(h => h.name === heroName);
                if (hero && hero.heroLogo) {
                    $input.css('background-image', `url(${hero.heroLogo})`);
                    $input.css('background-repeat', 'no-repeat');
                    $input.css('background-position', 'right 10px center');
                    $input.css('background-size', '30px 30px');
                }
            }
        });
    } catch (e) {
        console.error('恢复表单状态失败:', e);
    }
    // 恢复完表单和logo后，自动刷新图表
    fetchDataAndUpdateChart();
}

function formatWinRate(rate) {
    if (rate < 0.01) return '<0.01%';
    if (rate > 99.99) return '>99.99%';
    return rate.toFixed(2) + '%';
}
