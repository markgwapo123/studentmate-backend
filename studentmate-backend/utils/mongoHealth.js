// Native driver SDAM events expose connection state without application queries.
export function monitorMongo(client) {
 let connected = false;
 const usable = new Set(['Standalone', 'RSPrimary', 'RSSecondary', 'Mongos', 'LoadBalancer']);
 client.on('topologyDescriptionChanged', ({newDescription}) => {
  connected = [...newDescription.servers.values()].some(server => usable.has(server.type));
 });
 client.on('topologyClosed', () => { connected = false; });
 return {isConnected: () => connected, markConnected: () => { connected = true; }};
}
