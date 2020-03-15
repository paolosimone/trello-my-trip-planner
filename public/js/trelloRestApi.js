import { Constants } from './constants.js'

let TrelloApiClient = function (apiKey, token) {
    let apiModule = {};

    let TRELLO_API_BASE_URL = 'https://api.trello.com/1';

    let sendRequest = function(method, path, params) {
        params.key = apiKey;
        params.token = token;
        return $.ajax({
            method: method,
            url: TRELLO_API_BASE_URL + path,
            data: params,
        });
    }

    apiModule.lists = (function (){
        let subModule = {};

        subModule.post = function (params) {
            return sendRequest('POST', '/lists', params);
        }
        
        return subModule;
    })();

    apiModule.cards = (function (){
        let subModule = {};

        subModule.post = function (params) {
            return sendRequest('POST', '/cards', params);
        }
        
        subModule.put = function (id, params) {
            return sendRequest('PUT', `/cards/${id}`, params);
        }

        return subModule;
    })();

    return apiModule;
};

let _apiClientinstance = null;

let login = function (t) {
    return t.modal({
        title: 'Authorization needed',
        url: './views/authorize.html',
    });
}

let logout = function (t) {
    return t.getRestApi().clearToken();
}

let tryGetApiClient = async function (t) {
    if (!_apiClientinstance) {
        let token = await t.getRestApi().getToken();

        if (!token) {
            await login(t);
            return null;
        }

        _apiClientinstance = new TrelloApiClient(Constants.trelloApiKey, token);
    }

    return _apiClientinstance;
}

export { login, logout, tryGetApiClient };