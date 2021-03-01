
/*
{
    "type": "object",
    "description": "Request sent to your notification plugin url as a POST method",
    "properties": {
        "id": {
          "type": "string",
          "description": "unique id of the notification - save to prevent duplicate requests."
        },
        "iss": {
          "type": "string",
          "description": "IdP issuer - make sure it matches the token"
        },
        "type": {
          "type": "string",
          "description": "kind of request this is",
          "enum": ["invite", "forgotPassword", "passwordless"]
        },
        "formats": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["email", "sms"]
          }
        },
        "email": {
          "type": "string",
          "format": "email",
          "description": "email address of intended recipient"
        },
        "sms": {
          "type": "string",
          "description": "phone number of intended recipient"
        },
        "authGroup": {
          "type": "object",
          "description": "UE Auth Group to which the recipient is registered",
          "properties": {
            "id":{
              "type": "string"
            },
            "name":{
              "type": "string"
            },
          }
        },
        "screenUrl": {
          "type": "string",
          "description": "Url of the screen required to process type of notification sent - includes encoded tokens and other query parameters associated to the request. For password related functionality, this is not sent to the API requester directly."
        },
        "meta": {
          "type": "object",
          "description": "Additional json structured data specific to the request that may be useful"
        }
    }
}
 */

export default {
    async notify(data) {
        /**
         * if global notification config is enabled / else return null
         * if authgroup notification config is enabled / else return null
         * create notification
         * attempt axios send
         * if success update notification to processed
         */
    }
}