/*
    This script use the "npm outdated" command to show
    outdated package at prestart used in package.json, 
    without blocking the start if outdated packages exist.

    Note:
    - The console output is not colored with this script.
*/

const { exec } = require('child_process');

exec('npm outdated', (error, stdout, stderr) => {
    if (stdout) {
        console.log(stdout);
    }
    if (stderr) {
        console.log(stderr);
    }
    process.exit(0);
});