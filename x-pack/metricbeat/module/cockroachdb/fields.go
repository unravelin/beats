// Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
// or more contributor license agreements. Licensed under the Elastic License;
// you may not use this file except in compliance with the Elastic License.

// Code generated by beats/dev-tools/cmd/asset/asset.go - DO NOT EDIT.

package cockroachdb

import (
	"github.com/elastic/beats/v7/libbeat/asset"
)

func init() {
	if err := asset.SetFields("metricbeat", "cockroachdb", asset.ModuleFieldsPri, AssetCockroachdb); err != nil {
		panic(err)
	}
}

// AssetCockroachdb returns asset data.
// This is the base64 encoded zlib format compressed contents of module/cockroachdb.
func AssetCockroachdb() string {
	return "eJxcjztuxDAMBXud4kGNmzgHUJEiyQHSBykUiWsT1g8iVfj2C+8HMJblgAMOZ2y0O4Qatl59WOO/AZQ1kcP09aTfn5MBOiXyQg6LN0AkCZ2bci0OHwYATvvINY5EkNB9I2TSzkEwhMuCn14z6UpDQCW2ykXfDSCkymURh18rkuwb7Kra7J8BLkwpirudmVF8ptfoY3RvR16voz3I2bu75y+uAQAA//8vgE98"
}
