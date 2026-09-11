// Browser-only fixture. Inject into an owned test page; reload restores native WebSocket.
(() => {
  window.__p2RpcRequests = [];
  window.WebSocket = class extends EventTarget {
    constructor() {
      super(); this.closed = false; this.seq = 0; window.__p2Socket = this;
      setTimeout(() => this.event('gateway.ready', {}), 10);
    }
    frame(data) { if (!this.closed) this.dispatchEvent(new MessageEvent('message', {data: JSON.stringify(data)})); }
    event(type, payload) { this.frame({jsonrpc:'2.0',method:'event',params:{type,payload,seq:++this.seq,session_id:'p2-browser'}}); }
    send(raw) {
      const request = JSON.parse(raw); window.__p2RpcRequests.push(request);
      const result = value => this.frame({jsonrpc:'2.0',id:request.id,result:value});
      if (request.method === 'session.create') result({session_id:'p2-browser',stored_session_id:'p2-stored',info:{cwd:'/fixture',desktop_contract:6}});
      if (request.method === 'prompt.submit') {
        result({status:'streaming'});
        setTimeout(() => this.event('message.delta',{text:'分段'}),10);
        setTimeout(() => this.event('message.delta',{text:'回复'}),30);
        if (request.params.text === 'approve') setTimeout(() => this.event('approval.request',{request_id:'approval-1',command:'echo fixture-only',reason:'浏览器假服务测试，不执行命令',choices:['once','session','always','deny']}),50);
        else if (request.params.text !== 'hold') setTimeout(() => this.event('message.complete',{text:'完整测试回复',status:'complete'}),80);
      }
      if (request.method === 'approval.respond') {
        result({resolved:true});
        setTimeout(() => this.event('message.complete',{text:request.params.choice==='deny'?'测试审批已拒绝':'测试单次审批已确认',status:'complete'}),20);
      }
      if (request.method === 'session.interrupt') {
        result({status:'interrupted'});
        setTimeout(() => this.event('message.complete',{text:'测试已停止',status:'interrupted'}),20);
      }
    }
    close() { this.closed = true; }
  };
  return 'P2 browser RPC fixture installed';
})();
