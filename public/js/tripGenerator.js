let TripGenerator = async function (t) {
    let cls = {};

    let board = await t.board('all');
    let info = await t.get('board', 'shared');
    let lists = await t.lists('all');

    let getCards = lstName => (lists.find(l => l.name == lstName) || {}).cards || [];
    let toDictByUrl = cards => Object.fromEntries(cards.map(c => [c.url, c]));

    let days = getCards("Days");
    let travelsByUrl = toDictByUrl(getCards("Travels"));
    let hotelsByUrl = toDictByUrl(getCards("Hotels"));
    let activitiesByUrl = toDictByUrl(getCards("Activities"));

    let getHotelCard = function (dayCard) {
        let urls = dayCard.attachments.map(card => card.url).filter(url => url in hotelsByUrl);
        if (urls.length > 1) {
            throw `Day ${urls.name} has more than one hotel`;
        }
        return hotelsByUrl[urls[0]];
    }
    
    let buildOvernight = async function (hotelCard, full=true) {
        let hotel = await t.get(hotelCard.id, 'shared');

        let overnight = {
            hotel: hotelCard.name,
            location: hotel.location || "Unknown",
        }

        if (!full) {
            return overnight;
        }

        if (hotel.address) overnight.address = hotel.address;
        if (hotel.mail) overnight.mail = hotel.mail;
        if (hotel.phone) overnight.phone = hotel.phone;
        if (hotel.price) overnight.price = hotel.price;
        if (hotel.checkIn) overnight.checkIn = hotel.checkIn;
        if (hotel.checkOut) overnight.checkOut = hotel.checkOut;
        if (hotel.web) overnight.web = hotel.web;
        if (hotel.note) overnight.note = hotel.note.split("\n");

        return overnight;
    }

    let getTravelCards = function (dayCard) {
        return dayCard.attachments
            .map(card => card.url)
            .filter(url => url in travelsByUrl)
            .map(url => travelsByUrl[url]);
    }

    let buildTravels = async function(travelCards) {
        let travels = [];
        for (let i=0; i<travelCards.length; i++) {
            let travelCard = travelCards[i];
            let travel = await t.get(travelCard.id, 'shared');

            let travelObj = {
                travel: travelCard.name,
                from: travel.from || "Unknown",
                fromTime: ((travel.startDate || "") + " " + (travel.startTime || "")).trim() || "Unknown",
                to: travel.to || "Unknown",
                toTime: ((travel.stopDate || "") + " " + (travel.stopTime || "")).trim() || "Unknown",
            };

            if (travel.transport) travelObj.transport = travel.transport;
            if (travel.price) travelObj.price = travel.price;
            if (travel.web) travelObj.web = travel.web;
            if (travel.note) travelObj.note = travel.note.split("\n");

            travels.push(travelObj);
        }

        travels.sort((a, b) => a.fromTime.localeCompare(b.fromTime));

        return travels;
    }

    let getActivityCards = function (dayCard) {
        return dayCard.attachments
            .map(card => card.url)
            .filter(url => url in activitiesByUrl)
            .map(url => activitiesByUrl[url]);
    }

    let buildActivities = async function(activityCards) {
        let activities = [];
        for (let i=0; i<activityCards.length; i++) {
            let activityCard = activityCards[i];
            let activity = await t.get(activityCard.id, 'shared');

            let activityObj = {
                activity: activityCard.name,
            };

            if (activity.price) activityObj.price = activity.price;
            if (activity.web) activityObj.web = activity.web;
            if (activity.note) activityObj.note = activity.note.split("\n");

            activities.push(activityObj);
        }
        return activities;
    }

    cls.build = async function () {
        let trip = {
            name: board.name || "",
            version: info.version || "",
            startDate: info.startDate || "",
            stopDate: info.stopDate || "",
            map: info.mapUrl || "",
            days: [],
        };

        let lastHotelCard = {};
        for (let i = 0; i < days.length; i++) {
            let dayCard = days[i];

            let day = {
                day: dayCard.name,
                startLocation: i == 0 ? "Home" : trip.days[i-1].stopLocation,
                stopLocation: i == days.length-1 ? "Home" : "Unkown",
            };
    
            // hotel
            let hotelCard = getHotelCard(dayCard);
            if (hotelCard) {
                let isSameHotel = hotelCard.url == lastHotelCard.url;
                day.overnight = await buildOvernight(hotelCard, !isSameHotel);
                day.stopLocation = day.overnight.location;
            }
            lastHotelCard = hotelCard;

            // travels
            let travelCards = getTravelCards(dayCard);
            let travels = await buildTravels(travelCards);
            if (travels.length) day.travels = travels;

            // activities
            let activityCards = getActivityCards(dayCard);
            let activities = await buildActivities(activityCards);
            if (activities.length) day.activities = activities;
        
            trip.days.push(day);
        }

        return trip;
    }

    return cls;
}

export { TripGenerator };