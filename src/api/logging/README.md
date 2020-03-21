# Logging

This shows service shows an example of how an API, logic and Data access should be configured for a resource in this service. In this case the resource is logging. This is fact that there is a data access layer and API for logging here is primarily for show and you can disable the DB writes from the config "WRITE_LOGS_TO_DB": false" option. Of course, you can set it to true as well and it will record all log interactions in the DB for query via API.

## Implementation Details

* Separate API, Logic, DAL and Model files
* oData for queries
* JSON Patch for updating (not really something you would do in a log system but again, an example)

## Log Definition

Each log object has a unique GUID (uuidv4) for reference and is written to the console for collection by an appropriate listener. When peristed, these can be referenced via the API as well.

## Non-Persistent Use

Even if you set "WRITE_LOGS_TO_DB": false, do not delete this resource as it is and can be used for generally logging with most platforms.