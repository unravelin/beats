#!/bin/bash

MAGE_BIN=https://github.com/magefile/mage/releases/download/v1.15.0/mage_1.15.0_Linux-64bit.tar.gz
t=$(mktemp)
wget "$MAGE_BIN" -qO "$t"

if sha256sum "$t" | grep -Eo '^\w+' | cmp -s <(echo af8fb0c72944ec6e31c5dd54e642083400157883602f4a89a692c4ba96ee1e66)
    then mv "$t" mage.tar.gz
    else echo checksums don\'t match; rm "$t"; exit 1
fi

