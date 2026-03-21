#!/bin/bash

# Find the build.gradle file
GRADLE_FILE="android/app/build.gradle"

if [ ! -f "$GRADLE_FILE" ]; then
    echo "Error: $GRADLE_FILE not found!"
    exit 1
fi

echo "Updating $GRADLE_FILE to target SDK 35..."

# Use sed to replace targetSdkVersion and compileSdkVersion
# This replaces any number with 35
sed -i 's/targetSdkVersion [0-9]*/targetSdkVersion 35/' "$GRADLE_FILE"
sed -i 's/compileSdkVersion [0-9]*/compileSdkVersion 35/' "$GRADLE_FILE"

echo "Done! Checking the result:"
grep -E "targetSdkVersion|compileSdkVersion" "$GRADLE_FILE"
