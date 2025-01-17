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
    // https://cloud.google.com/logging/docs/reference/v2/rest/v2/MonitoredResource
    var setCloudMetadata = new processor.Convert({
        fields: [
            {
                from: "json.resource.labels.project_id",
                to: "cloud.project.id",
                type: "string"
            },
            {
                from: "json.resource.labels.instance_id",
                to: "cloud.instance.id",
                type: "string"
            }
        ],
        ignore_missing: true,
        fail_on_error: false,
    });

    var setOrchestratorMetadata = function(evt) {
        if (evt.Get("json.resource.type") === "k8s_cluster") {
            evt.Put("orchestrator.type", "kubernetes");
            var convert_processor = new processor.Convert({
                fields: [
                    {
                        from: "json.resource.labels.cluster_name",
                        to: "orchestrator.cluster.name",
                        type: "string"
                    },
                    {
                        from: "json.protoPayload.resourceName",
                        to: "orchestrator.resource.type_temp",
                        type: "string"
                    }
                ],
                ignore_missing: true,
                fail_on_error: false,
            }).Run(evt);
        }
    };

    // adding a boolean attribute for dry-run denied events in binary authorization.
    // https://cloud.google.com/binary-authorization/docs/viewing-audit-logs#dry_run_events
    // adding a boolean attribute for breakglass events in binary authorization
    // https://cloud.google.com/binary-authorization/docs/viewing-audit-logs#view_breakglass_events
    var checkBinaryAuthLabels = function(evt){
        var labels = evt.Get("json.labels")

        if(typeof labels === 'object' && labels !== null){
           if ("imagepolicywebhook.image-policy.k8s.io/dry-run" in labels){
                evt.Put("gcp.audit.binary_auth.dry_run_denied", true)
           }
           if("imagepolicywebhook.image-policy.k8s.io/break-glass" in labels){
                evt.Put("gcp.audit.binary_auth.breakglass_used", true)
           }
           if("imagepolicywebhook.image-policy.k8s.io/overridden-verification-result" in labels){
                var image = labels["imagepolicywebhook.image-policy.k8s.io/overridden-verification-result"]
                if(image.match(/'.*'/g).length>0){
                    evt.Put("gcp.audit.binary_auth.image", image.match(/'.*'/g)[0].slice(1, -1))
                }
           }
        }
    }


    // The log includes a protoPayload field.
    // https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry
    var convertLogEntry = new processor.Convert({
        fields: [
            {from: "json.protoPayload", to: "json"},
        ],
        mode: "rename",
    });

    // The LogEntry's protoPayload is moved to the json field. The protoPayload
    // contains the structured audit log fields.
    // https://cloud.google.com/logging/docs/reference/audit/auditlog/rest/Shared.Types/AuditLog
    var convertProtoPayload = new processor.Convert({
        fields: [
            {
                from: "json.@type",
                to: "gcp.audit.type",
                type: "string"
            },
            {
                from: "json.authenticationInfo.principalEmail",
                to: "gcp.audit.authentication_info.principal_email",
                type: "string"
            },
            {
                from: "json.authenticationInfo.authoritySelector",
                to: "gcp.audit.authentication_info.authority_selector",
                type: "string"
            },
            {
                from: "json.authorizationInfo",
                to: "gcp.audit.authorization_info"
                // Type is an array of objects.
            },
            {
                from: "json.methodName",
                to: "gcp.audit.method_name",
                type: "string",
            },
            {
                from: "json.numResponseItems",
                to: "gcp.audit.num_response_items",
                type: "long"
            },
            {
                from: "json.request.@type",
                to: "gcp.audit.request.proto_name",
                type: "string"
            },
            // The values in the request object will depend on the proto type.
            // So be very careful about making any assumptions about data shape.
            {
                from: "json.request.filter",
                to: "gcp.audit.request.filter",
                type: "string"
            },
            {
                from: "json.request.name",
                to: "gcp.audit.request.name",
                type: "string"
            },
            {
                from: "json.request.resourceName",
                to: "gcp.audit.request.resource_name",
                type: "string"
            },
            {
                from: "json.requestMetadata.callerIp",
                to: "gcp.audit.request_metadata.caller_ip",
                type: "ip"
            },
            {
                from: "json.requestMetadata.callerSuppliedUserAgent",
                to: "gcp.audit.request_metadata.caller_supplied_user_agent",
                type: "string",
            },
            {
                from: "json.response.@type",
                to: "gcp.audit.response.proto_name",
                type: "string"
            },
            // The values in the response object will depend on the proto type.
            // So be very careful about making any assumptions about data shape.
            {
                from: "json.response.status",
                to: "gcp.audit.response.status",
                type: "string"
            },
            {
                from: "json.response.reason",
                to: "event.reason",
                type: "string"
                // ravelin addition: view specific details of response status (for example binary authorization policy violation)
            },
            {
                from: "json.response.details.group",
                to: "gcp.audit.response.details.group",
                type: "string"
            },
            {
                from: "json.response.details.kind",
                to: "gcp.audit.response.details.kind",
                type: "string"
            },
            {
                from: "json.response.details.name",
                to: "gcp.audit.response.details.name",
                type: "string"
            },
            {
                from: "json.response.details.uid",
                to: "gcp.audit.response.details.uid",
                type: "string",
            },
            {
                from: "json.resourceName",
                to: "gcp.audit.resource_name",
                type: "string",
            },
            {
                from: "json.resourceLocation.currentLocations",
                to: "gcp.audit.resource_location.current_locations"
                // Type is a string array.
            },
            {
                from: "json.serviceData.policyDelta.auditConfigDeltas",
                to: "gcp.audit.policy_delta.audit_config_deltas"
                // Type is an array of objects.
                // ravelin addition: view specific details of audit config changes
            },
            {
                from: "json.serviceData.policyDelta.bindingDeltas",
                to: "gcp.audit.policy_delta.binding_deltas"
                // Type is an array of objects.
                // ravelin addition: view specific details of policy changes
            },
            {
                from: "json.requestMetadata.requestAttributes.host",
                to: "gcp.audit.iap.host",
                type: "string",
                // ravelin addition: host of IAP endpoint
            },
            {
                from: "json.requestMetadata.requestAttributes.path",
                to: "gcp.audit.iap.path",
                type: "string",
                // ravelin addition: path of IAP endpoint
            },
            {
                from: "json.serviceName",
                to: "gcp.audit.service_name",
                type: "string",
            },
            {
                from: "json.status.code",
                to: "gcp.audit.status.code",
                type: "integer",
            },
            {
                from: "json.status.message",
                to: "gcp.audit.status.message",
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
                from: "gcp.audit.request_metadata.caller_ip",
                to: "source.ip",
                type: "ip"
            },
            {
                from: "gcp.audit.authentication_info.principal_email",
                to: "user.email",
                type: "string"
            },
            {
                from: "gcp.audit.service_name",
                to: "service.name",
                type: "string"
            },
            {
                from: "gcp.audit.request_metadata.caller_supplied_user_agent",
                to: "user_agent.original",
                type: "string"
            },
            {
                from: "gcp.audit.method_name",
                to: "event.action",
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

    // Rename nested fields.
    var renameNestedFields = function(evt) {
        var arr = evt.Get("gcp.audit.authorization_info");
        if (Array.isArray(arr)) {
            for (var i = 0; i < arr.length; i++) {
                if (arr[i].resourceAttributes) {
                    // Convert to snake_case.
                    arr[i].resource_attributes = arr[i].resourceAttributes;
                    delete arr[i].resourceAttributes;
                }
            }
        }
    };

    var copyBigQueryFields = function(evt) {
        // SQL query job
        var query = evt.Get("json.metadata.jobChange.job.jobConfig.queryConfig.query");
        if (query != undefined) {
            evt.Put("gcp.audit.bigquery.query", query)
            if (query.toUpperCase().indexOf("EXPORT DATA OPTIONS") != -1) { // sometimes exports are performed in SQL query
                var res = query.match(/uri=['"]\S+['"]/)
                evt.Put("gcp.audit.bigquery.export_destination", res[0].slice(5, -1))
            }
        }

        var arr = evt.Get("json.serviceData.jobGetQueryResultsResponse.job.jobStatistics.referencedTables");
        if (Array.isArray(arr)) {
            evt.Put("gcp.audit.bigquery.dataset_id", arr[0].datasetId);
            evt.Put("gcp.audit.bigquery.table_id", arr[0].tableId);
        }

        // Fetching temporary dataset and table IDs to match export sizes
        var tmpDatasetId = evt.Get("json.serviceData.jobGetQueryResultsResponse.job.jobConfiguration.query.destinationTable.datasetId");
        if (tmpDatasetId != undefined) {
            evt.Put("gcp.audit.bigquery.tmp_dataset_id", tmpDatasetId)
        }
        var tmpTableId = evt.Get("json.serviceData.jobGetQueryResultsResponse.job.jobConfiguration.query.destinationTable.tableId");
        if (tmpTableId != undefined) {
            evt.Put("gcp.audit.bigquery.tmp_table_id", tmpTableId)
        }
        var outputRowCount = evt.Get("json.serviceData.jobGetQueryResultsResponse.job.jobStatistics.queryOutputRowCount")
        if (outputRowCount != undefined) {
            evt.Put("gcp.audit.bigquery.output_row_count", outputRowCount)
        }
        // Export job (usually export to gdrive)
        var config = evt.Get("json.metadata.jobInsertion.job.jobConfig.extractConfig");
        if (config != undefined){
            if (config.hasOwnProperty('destinationUris')) {
                if (Array.isArray(config.destinationUris) && config.destinationUris.length > 0) {
                    evt.Put("gcp.audit.bigquery.export_destination", config.destinationUris[0])
                    evt.Put("gcp.audit.bigquery.tmp_dataset_id", config.sourceTable.split("/")[3])
                    evt.Put("gcp.audit.bigquery.tmp_table_id", config.sourceTable.split("/")[5])
                }
            }
        }
    }

    // Set ECS categorization fields.
    var setECSCategorization = function(evt) {
        evt.Put("event.kind", "event");

        // google.rpc.Code value for OK is 0.
        if (evt.Get("gcp.audit.status.code") === 0) {
            evt.Put("event.outcome", "success");
            return;
        }

        // Try to use authorization_info.granted when there was no status code.
        if (evt.Get("gcp.audit.status.code") == null) {
            var authorization_info = evt.Get("gcp.audit.authorization_info");
            if (Array.isArray(authorization_info) && authorization_info.length === 1) {
                if (authorization_info[0].granted === true) {
                    evt.Put("event.outcome", "success");
                } else if (authorization_info[0].granted === false) {
                    evt.Put("event.outcome", "failure");
                }
                return
            }

            evt.Put("event.outcome", "unknown");
            return;
        }

        evt.Put("event.outcome", "failure");
    };

    var pipeline = new processor.Chain()
        .Add(decodeJson)
        .Add(parseTimestamp)
        .Add(saveOriginalMessage)
        .Add(dropPubSubFields)
        .Add(saveMetadata)
        .Add(setCloudMetadata)
        .Add(setOrchestratorMetadata)
        .Add(checkBinaryAuthLabels)
        .Add(convertLogEntry)
        .Add(convertProtoPayload)
        .Add(copyFields)
        .Add(copyBigQueryFields)
        .Add(dropExtraFields)
        .Add(renameNestedFields)
        .Add(setECSCategorization)
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
