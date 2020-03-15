import { Constants } from './constants.js'
import { login, logout, tryGetApiClient } from './trelloRestApi.js'
import { TripGenerator } from './tripGenerator.js'

var Promise = TrelloPowerUp.Promise;

/* Trip */

var initialize = async function(t) {
    let client = await tryGetApiClient(t);
    if (!client) return false;

    let board = await t.board('all');
    let lists = await t.lists('all');
    let listNames = new Set();
    lists.forEach(l => listNames.add(l.name));
    
    let missingNames = ["Days", "Travels", "Hotels", "Activities"].filter(n => !listNames.has(n));
    for (let i=0; i < missingNames.length; i++) {
        await client.lists.post({ idBoard: board.id, name: missingNames[i], pos: "bottom" });
    }
    return true;
}

var openTripInfo = async function (t) {
    var isInitialized = await initialize(t);
    if (!isInitialized) return;

    return t.modal({
        title: 'Trip Info',
        url: './views/trip-info.html',
    });
}

var refreshDaysList = async function (t) {
    let client = await tryGetApiClient(t);
    if (!client) return;

    const dateFormat = 'YYYY-MM-DD';

    let list = await t.list('all');
    let trip = await t.get('board', 'shared');

    let startDate = moment(trip.startDate, dateFormat);
    if (!startDate.isValid()) {
        return t.alert({
            message: 'Trip start date has not been set',
            display: 'error',
        });
    }

    let stopDate = moment(trip.stopDate, dateFormat);
    if (!stopDate.isValid()) {
        return t.alert({
            message: 'Trip stop date has not been set',
            display: 'error',
        });
    }

    let cards = (await t.list('cards')).cards;
    let totDays = stopDate.diff(startDate, 'days') + 1;

    // update existing / create missing
    for (let i = 0; i < totDays; i++) {
        let date = moment(startDate).add(i, 'days');
        let name = `${date.format(dateFormat)} | Day ${i+1}`;
        if (i < cards.length) {
            let card = cards[i];
            if (card.name != name)
                await client.cards.put(card.id, { name: name });
        } else {
            await client.cards.post({ idList: list.id, name: name });
        }
    }

    // mark extra
    for (let i = totDays; i < cards.length; i++) {
        let card = cards[i];
        await client.cards.put(card.id, { name: "EXTRA" });
    }
}

var exportDaysList = async function (t) {
    try {
        console.log("---- TRIP EXPORT ----");
        await refreshDaysList(t);
        let tripGenerator = await TripGenerator(t);
        let trip = await tripGenerator.build();
        let yaml = jsyaml.dump(trip).replace(/  - day/g, "\n  - day");
        let filename = (trip.name || "Trip").replace(/\s/g, "") + (trip.version ? `_${trip.version}` : "")  + '.yaml';
        saveFile(filename, yaml);
    } catch (e) {
        console.log(e)
        await t.alert({
            message: e,
            display: 'error',
        });
    }
}

var saveFile = function (filename, data) {
    var blob = new Blob([data], {type: 'text/plain'});

    if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename);
        return;
    }

    var elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = filename;        
    document.body.appendChild(elem);
    elem.click();        
    document.body.removeChild(elem);
}

/* Initialize */

TrelloPowerUp.initialize({
    'board-buttons': function (t, opts) {
        return [{
          text: 'Trip Info',
          callback: openTripInfo,
        }];
    },
    'list-actions': function (t, opts) {
        return t.list('name', 'id')
            .then(function (list) {
                let actions = [];

                if (list.name == "Days") {
                    actions.push({
                        text: "Refresh",
                        callback: refreshDaysList,
                    });

                    actions.push({
                        text: "Export",
                        callback: exportDaysList,
                    });
                }

                return actions;
            });
    },
    'card-back-section': function(t, options){
        return t.list('name', 'id')
            .then(function (list) {
                if (list.name == "Travels") {
                    return {
                        title: 'Travel',
                        icon: './assets/travel-24px.svg', 
                        content: {
                            type: 'iframe',
                            url: t.signUrl('./views/travel-info.html'),
                            height: 300 // Max height is 500
                        }
                    };
                }  

                if (list.name == "Hotels") {
                    return {
                        title: 'Hotel',
                        icon: './assets/home-24px.svg', 
                        content: {
                            type: 'iframe',
                            url: t.signUrl('./views/hotel-info.html'),
                            height: 300 // Max height is 500
                        }
                    };
                }

                if (list.name == "Activities") {
                    return {
                        title: 'Activity',
                        icon: './assets/activity-24px.svg', 
                        content: {
                            type: 'iframe',
                            url: t.signUrl('./views/activity-info.html'),
                            height: 300 // Max height is 500
                        }
                    };
                }
            });
    },
    'on-enable' : async function (t, opts) {
        await login(t);
        await initialize(t);
    },
    'on-disable' : async function (t, opts) {
        await logout(t);
    },
}, {
    appKey: Constants.trelloApiKey,
    appName: Constants.powerupName,
});
