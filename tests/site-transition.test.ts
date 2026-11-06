import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React from 'react';
import {render,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {Header} from '../src/components/ui';

function environment(reduced=false,rejectPlay=false) {
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
  const old=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})) {
    old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  const listeners=new Set<(event:{matches:boolean})=>void>();
  Object.defineProperty(dom.window,'matchMedia',{value:()=>({matches:reduced,addEventListener:(_name:string,fn:(event:{matches:boolean})=>void)=>listeners.add(fn),removeEventListener:(_name:string,fn:(event:{matches:boolean})=>void)=>listeners.delete(fn)})});
  dom.window.HTMLMediaElement.prototype.play=()=>rejectPlay?Promise.reject(new Error('Autoplay blocked')):Promise.resolve();
  dom.window.HTMLMediaElement.prototype.pause=()=>{};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  return {dom,listeners,restore(){cleanup();dom.window.close();for(const [key,descriptor]of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}};
}

test('first entry plays the supplied clip and phase changes replay it without polling replays',async()=>{
  const env=environment();
  try {
    const ui=render(React.createElement(Header,{phase:'lobby',connected:true}));
    const video=await waitFor(()=>ui.getByRole('dialog',{name:'Page transition'}).querySelector('video')!);
    assert.ok(video);assert.equal(video.muted,true);assert.equal(video.playsInline,true);
    assert.match(video.getAttribute('src')??'',/eclipse/);
    fireEvent.ended(video);
    await waitFor(()=>assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false));
    ui.rerender(React.createElement(Header,{phase:'lobby',connected:false}));
    assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false);
    ui.unmount();
    const revisit=render(React.createElement(Header,{phase:'lobby',connected:true}));
    assert.equal(Boolean(revisit.queryByRole('dialog',{name:'Page transition'})),false);
    for(const [phase,activePage]of [['drafting',undefined],['review',undefined],['complete',undefined],['complete','bracket']] as const) {
      revisit.rerender(React.createElement(Header,{phase,activePage,connected:true}));
      const next=await waitFor(()=>revisit.getByRole('dialog',{name:'Page transition'}).querySelector('video')!);
      fireEvent.ended(next);
      await waitFor(()=>assert.equal(Boolean(revisit.queryByRole('dialog',{name:'Page transition'})),false));
    }
  } finally {env.restore();}
});

test('skip and video errors release the page, and rapid phase updates do not restart playback',async()=>{
  const env=environment();
  try {
    const ui=render(React.createElement(Header,{phase:'lobby',connected:true}));
    const video=await waitFor(()=>ui.getByRole('dialog',{name:'Page transition'}).querySelector('video')!);
    video.currentTime=0.8;
    ui.rerender(React.createElement(Header,{phase:'drafting',connected:true}));
    assert.ok(ui.getByRole('dialog',{name:'Page transition'}).querySelector('video')===video);
    assert.equal(video.currentTime,0.8);
    fireEvent.click(ui.getByRole('button',{name:'Skip animation'}));
    await waitFor(()=>assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false));
    ui.rerender(React.createElement(Header,{phase:'complete',connected:true}));
    const failed=await waitFor(()=>ui.getByRole('dialog',{name:'Page transition'}).querySelector('video')!);
    fireEvent.error(failed);
    await waitFor(()=>assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false));
  } finally {env.restore();}
});

test('reduced motion skips transitions and blocked autoplay cannot block the site',async()=>{
  const env=environment(true);
  try {
    const ui=render(React.createElement(Header,{phase:'lobby',connected:true}));
    assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false);
    ui.rerender(React.createElement(Header,{phase:'drafting',connected:true}));
    assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false);
  } finally {env.restore();}
  const blocked=environment(false,true);
  try {
    const ui=render(React.createElement(Header,{phase:'lobby',connected:true}));
    assert.ok(ui.getByRole('dialog',{name:'Page transition'}));
    await waitFor(()=>assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false));
  } finally {blocked.restore();}
});

test('strict-mode entry and a full results-to-bracket navigation play and release correctly',async()=>{
  const env=environment();
  try {
    const ui=render(React.createElement(React.StrictMode,null,React.createElement(Header,{phase:'complete',connected:true})));
    const video=await waitFor(()=>ui.getByRole('dialog',{name:'Page transition'}).querySelector('video')!);
    fireEvent.ended(video);
    await waitFor(()=>assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false));
    ui.unmount();
    const next=render(React.createElement(Header,{connected:false,activePage:'bracket'}));
    assert.equal(Boolean(next.queryByRole('dialog',{name:'Page transition'})),false);
    next.rerender(React.createElement(Header,{phase:'complete',connected:true,activePage:'bracket'}));
    const newVideo=await waitFor(()=>next.getByRole('dialog',{name:'Page transition'}).querySelector('video')!);
    fireEvent.ended(newVideo);
    await waitFor(()=>assert.equal(Boolean(next.queryByRole('dialog',{name:'Page transition'})),false));
  } finally {env.restore();}
});

test('blocked storage does not prevent phase changes or dismissing the clip',async()=>{
  const env=environment();
  try {
    Object.defineProperty(env.dom.window,'sessionStorage',{get(){throw new Error('Storage unavailable');},configurable:true});
    const ui=render(React.createElement(Header,{phase:'lobby',connected:true}));
    fireEvent.ended(await waitFor(()=>ui.getByRole('dialog',{name:'Page transition'}).querySelector('video')!));
    await waitFor(()=>assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false));
    ui.rerender(React.createElement(Header,{phase:'drafting',connected:true}));
    fireEvent.click(await waitFor(()=>ui.getByRole('button',{name:'Skip animation'})));
    await waitFor(()=>assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false));
  } finally {env.restore();}
});

test('a stalled video times out instead of leaving the site covered',async()=>{
  const env=environment();
  try {
    const ui=render(React.createElement(Header,{phase:'lobby',connected:true}));
    assert.ok(ui.getByRole('dialog',{name:'Page transition'}));
    await waitFor(()=>assert.equal(Boolean(ui.queryByRole('dialog',{name:'Page transition'})),false),{timeout:6500});
  } finally {env.restore();}
});
