# server-mgr

Simple application to do WOL of an host connected to the host where this is running.

The client-server structure is done to be able to both show a web interface or a simple cli, if desired.

The server-client idea started from https://github.com/tsoding/multiplayer-game-prototype

## Running it

First, compile the files, and run the server
```shell
npm run build && npm run serve
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

and then proceed as before:

Run the server

```shell
npm run serve
```

Run the CLI interface
```shell
node run dist/client_cli.mjs
```