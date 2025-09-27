    'use strict';

    console.log(`stdin is a TTY: ${process.stdin.isTTY}`);

    if (process.stdin.isTTY) {
      console.log('Setting raw mode...');
      try {
        process.stdin.setRawMode(true);
        console.log('Raw mode is successfully set.');
      } catch (err) {
        console.error('Failed to set raw mode:', err);
      }
    } else {
      console.log('stdin is not a TTY, raw mode is not supported.');
    }

    if (process.stdin.isTTY) {
        process.stdin.on('data', (key) => {
            console.log('You pressed: ', key);
            if (key.toString() === '\u0003') { // ctrl-c
                process.exit();
            }
        });
    }
