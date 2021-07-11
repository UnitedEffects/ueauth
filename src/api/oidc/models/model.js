import Default from "./default";
import Session from "./session";
import AccessToken from './accessToken';
import AuthorizationCode from './authorizationCode';
import Client from './client';
import ClientCredentials from './clientCredentials';
import DeviceCode from './deviceCode';
import InitialAccessToken from './initialAccessToken';
import Interactions from './interaction';
import PushedAuthorizationRequest from './pushedAuthorizationRequest';
import RefreshToken from './refreshToken';
import RegistrationAccessToken from './registrationAccessToken';
import ReplayDetection from './replayDetection';
import Grant from './grant';

function getModel (name) {
    switch (name) {
        case Session.modelName:
            return Session;
        case AccessToken.modelName:
            return AccessToken;
        case AuthorizationCode.modelName:
            return AuthorizationCode;
        case Client.modelName:
            return Client;
        case ClientCredentials.modelName:
            return ClientCredentials;
        case DeviceCode.modelName:
            return DeviceCode;
        case InitialAccessToken.modelName:
            return InitialAccessToken;
        case Interactions.modelName:
            return Interactions;
        case PushedAuthorizationRequest.modelName:
            return PushedAuthorizationRequest;
        case RefreshToken.modelName:
            return RefreshToken;
        case RegistrationAccessToken.modelName:
            return RegistrationAccessToken;
        case ReplayDetection.modelName:
            return ReplayDetection;
        case Grant.modelName:
            return Grant;
        default:
            return Default(name);
    }
}

export default getModel;