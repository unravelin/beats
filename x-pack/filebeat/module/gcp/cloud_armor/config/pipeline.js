// Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
// or more contributor license agreements. Licensed under the Elastic License;
// you may not use this file except in compliance with the Elastic License.

function Audit(keep_original_message) {
    var processor = require("processor");

    // The pub/sub input writes the Stackdriver LogEntry object into the message
    // field. The message needs decoded as JSON.
    var decodeJson = new processor.DecodeJSONFields({
        fields: ["message"],
        target: "json",
    });

    // Set @timetamp the LogEntry's timestamp.
    var parseTimestamp = new processor.Timestamp({
        field: "json.timestamp",
        timezone: "UTC",
        layouts: ["2006-01-02T15:04:05.999999999Z07:00"],
        tests: ["2019-06-14T03:50:10.845445834Z"],
        ignore_missing: true,
    });

    var saveOriginalMessage = function(evt) {};
    if (keep_original_message) {
        saveOriginalMessage = new processor.Convert({
            fields: [
                {from: "message", to: "event.original"}
            ],
            mode: "rename"
        });
    }

    var dropPubSubFields = function(evt) {
        evt.Delete("message");
    };

    var saveMetadata = new processor.Convert({
        fields: [
            {from: "json.logName", to: "log.logger"},
            {from: "json.insertId", to: "event.id"},
        ],
        ignore_missing: true
    });

    // Use the monitored resource type's labels to set the cloud metadata.
    // The labels can vary based on the resource.type.
    var setCloudMetadata = new processor.Convert({
        fields: [
            {
                from: "json.resource.labels.project_id",
                to: "cloud.project.id",
                type: "string"
            },
            {
                from: "json.resource.labels.backend_service_name",
                to: "cloud.backend.name",
                type: "string"
            }
        ],
        ignore_missing: true,
        fail_on_error: false,
    });

    // Keep httpRequest metadata in message
    var convertHttpRequest = new processor.Convert({
        fields: [
            {
                from: "json.httpRequest.requestMethod",
                to: "gcp.cloud_armor.http_request.method",
                type: "string"
            },
            {
                from: "json.httpRequest.requestUrl",
                to: "gcp.cloud_armor.http_request.url",
                type: "string"
            },
            {
                from: "json.httpRequest.requestSize",
                to: "gcp.cloud_armor.http_request.request_size",
                type: "string"
            },
            {
                from: "json.httpRequest.status",
                to: "gcp.cloud_armor.http_request.status_code",
                type: "integer"
            },
            {
                from: "json.httpRequest.responseSize",
                to: "gcp.cloud_armor.http_request.response_size",
                type: "string"
            },
            {
                from: "json.httpRequest.userAgent",
                to: "gcp.cloud_armor.http_request.user_agent",
                type: "string"
            },
            {
                from: "json.httpRequest.remoteIp",
                to: "gcp.cloud_armor.http_request.remote_ip",
                type: "ip"
            },
            {
                from: "json.httpRequest.serverIp",
                to: "gcp.cloud_armor.http_request.server_ip",
                type: "ip"
            },
            {
                from: "json.httpRequest.referer",
                to: "gcp.cloud_armor.http_request.referer",
                type: "string"
            },
        ],
        mode: "rename",
        ignore_missing: true,
        fail_on_error: false,
    });

    // The log includes a jsonPayload field.
    // https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry
    var convertLogEntry = new processor.Convert({
        fields: [
            {from: "json.jsonPayload", to: "json"},
        ],
        mode: "rename",
    });

    var convertJsonPayload = new processor.Convert({
        fields: [
            {
                from: "json.@type",
                to: "gcp.cloud_armor.type",
                type: "string"
            },
            // enforcedSecurityPolicy
            {
                from: "json.enforcedSecurityPolicy.configuredAction",
                to: "gcp.cloud_armor.enforced_security_policy.action",
                type: "string"
            },
            {
                from: "json.enforcedSecurityPolicy.outcome",
                to: "gcp.cloud_armor.enforced_security_policy.outcome",
                type: "string"
            },
            {
                from: "json.enforcedSecurityPolicy.preconfiguredExprIds",
                to: "gcp.cloud_armor.enforced_security_policy.signature_ids",
                // Type is a string array.
            },
            {
                from: "json.enforcedSecurityPolicy.priority",
                to: "gcp.cloud_armor.enforced_security_policy.priority",
                type: "integer"
            },
            {
                from: "json.enforcedSecurityPolicy.name",
                to: "gcp.cloud_armor.enforced_security_policy.name",
                type: "string"
            },
            // previewSecurityPolicy
            {
                from: "json.previewSecurityPolicy.configuredAction",
                to: "gcp.cloud_armor.preview_security_policy.action",
                type: "string"
            },
            {
                from: "json.previewSecurityPolicy.outcome",
                to: "gcp.cloud_armor.preview_security_policy.outcome",
                type: "string"
            },
            {
                from: "json.previewSecurityPolicy.preconfiguredExprIds",
                to: "gcp.cloud_armor.preview_security_policy.signature_ids",
                // Type is a string array.
            },
            {
                from: "json.previewSecurityPolicy.priority",
                to: "gcp.cloud_armor.preview_security_policy.priority",
                type: "integer"
            },
            {
                from: "json.previewSecurityPolicy.name",
                to: "gcp.cloud_armor.preview_security_policy.name",
                type: "string"
            },
        ],
        mode: "rename",
        ignore_missing: true,
        fail_on_error: false,
    });

    // Copy some fields
    var copyFields = new processor.Convert({
        fields: [
            {
                from: "json.http_request.remote_ip",
                to: "source.ip",
                type: "ip"
            },
            {
                from: "cloud.backend.name",
                to: "service.name",
                type: "string"
            },
            {
                from: "json.http_request.user_agent",
                to: "user_agent.original",
                type: "string"
            },
        ],
        ignore_missing: true,
        fail_on_error: false,
    });

    // Drop extra fields
    var dropExtraFields = function(evt) {
        evt.Delete("json");
    };

    var pipeline = new processor.Chain()
        .Add(decodeJson)
        .Add(parseTimestamp)
        .Add(saveOriginalMessage)
        .Add(dropPubSubFields)
        .Add(saveMetadata)
        .Add(setCloudMetadata)
        .Add(convertHttpRequest)
        .Add(convertLogEntry)
        .Add(convertJsonPayload)
        .Add(copyFields)
        .Add(dropExtraFields)
        .Build();

    return {
        process: pipeline.Run,
    };
}

var audit;

// Register params from configuration.
function register(params) {
    audit = new Audit(params.keep_original_message);
}

function process(evt) {
    return audit.process(evt);
}
