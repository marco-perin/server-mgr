# server-mgr

Simple web application to manage a few hosts on the network and send WOL packages to them.

It works with a client-server structure, communicating through websockets,
 to be able to both show a web interface or later a simple cli, if desired.

The server-client idea started from [tsoding/multiplayer-game-prototype](https://github.com/tsoding/multiplayer-game-prototype).

## Usage

A simple sh script is provided ([start_in_tmux.sh](./start_in_tmux.sh))
in order to start a tmux session in detached mode, to serve the application.

A oneliner to build and run the app is therefore

```shell
npm run build && ./start_in_tmux.sh
```

Then, you can directly access the web client at
[http://localhost:6969](http://localhost:6969),
or you can access the CLI interface runnning

```shell
node run dist/client_cli.mjs
```

### External access

By default the server only listen to connections from localhost.
To accept connection from the whole LAN, you can do the following thing in
[serve.js](serve.js)

```js
// Comment this line
// cmd('http-server', ['-p', '6969', '-a', '127.0.0.1', '-s', '-c-1', '-d', 'false'])
// Uncomment this one
cmd('http-server', ['-p', '6969', '-a', '0.0.0.0', '-s', '-c-1', '-d', 'false'])
```

## Development

To dev, you can run the compilation in watch mode, running in a terminal

```shell
npm run watch
```

And then serve the application in another terminal using

```shell
npm run serve
```

Run the CLI interface

```shell
node run dist/client_cli.mjs
```
