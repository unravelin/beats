// Licensed to Elasticsearch B.V. under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. Elasticsearch B.V. licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

//go:build integration

package integration

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoggingConsoleECS(t *testing.T) {
	cfg := `
mockbeat:
name:
queue.mem:
  events: 4096
  flush.min_events: 8
  flush.timeout: 0.1s
output.console:
  code.json:
    pretty: false
`
	mockbeat := NewBeat(t, "mockbeat", "../../libbeat.test", "-e")
	mockbeat.WriteConfigFile(cfg)
	mockbeat.Start()
	line := mockbeat.WaitStdErrContains("ecs.version", 60*time.Second)

	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(line), &m), "Unmarshaling log line as json")

	_, ok := m["log.level"]
	assert.True(t, ok)

	_, ok = m["@timestamp"]
	assert.True(t, ok)

	_, ok = m["message"]
	assert.True(t, ok)
}

func TestLoggingFileDefault(t *testing.T) {
	cfg := `
mockbeat:
name:
queue.mem:
  events: 4096
  flush.min_events: 8
  flush.timeout: 0.1s
output.console:
  code.json:
    pretty: false
`
	mockbeat := NewBeat(t, "mockbeat", "../../libbeat.test")
	mockbeat.WriteConfigFile(cfg)
	mockbeat.Start()
	mockbeat.WaitStdOutContains("Mockbeat is alive!", 60*time.Second)
}
