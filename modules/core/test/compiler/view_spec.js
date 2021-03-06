import {describe, xit, it, expect, beforeEach, ddescribe, iit, el} from 'test_lib/test_lib';
import {ProtoView, ElementPropertyMemento, DirectivePropertyMemento} from 'core/compiler/view';
import {ProtoElementInjector, ElementInjector} from 'core/compiler/element_injector';
import {ShadowDomEmulated} from 'core/compiler/shadow_dom';
import {DirectiveMetadataReader} from 'core/compiler/directive_metadata_reader';
import {Component, Decorator, Template} from 'core/annotations/annotations';
import {OnChange} from 'core/core';
import {Lexer, Parser, ProtoChangeDetector, ChangeDetector} from 'change_detection/change_detection';
import {TemplateConfig} from 'core/annotations/template_config';
import {EventEmitter} from 'core/annotations/events';
import {List, MapWrapper} from 'facade/collection';
import {DOM, Element} from 'facade/dom';
import {int, proxy, IMPLEMENTS} from 'facade/lang';
import {Injector} from 'di/di';
import {View} from 'core/compiler/view';
import {ViewPort} from 'core/compiler/viewport';
import {reflector} from 'reflection/reflection';


@proxy
@IMPLEMENTS(ViewPort)
class FakeViewPort {
  templateElement;

  constructor(templateElement) {
    this.templateElement = templateElement;
  }

  noSuchMethod(i) {
    super.noSuchMethod(i);
  }
}


export function main() {
  describe('view', function() {
    var parser, someComponentDirective, someTemplateDirective;

    function createView(protoView) {
      var ctx = new MyEvaluationContext();
      var view = protoView.instantiate(null);
      view.hydrate(null, null, ctx);
      return view;
    }

    beforeEach(() => {
      parser = new Parser(new Lexer());
      someComponentDirective = new DirectiveMetadataReader().read(SomeComponent);
      someTemplateDirective = new DirectiveMetadataReader().read(SomeTemplate);
    });

    describe('instantiated from protoView', () => {
      var view;
      beforeEach(() => {
        var pv = new ProtoView(el('<div id="1"></div>'), new ProtoChangeDetector());
        view = pv.instantiate(null);
      });

      it('should be dehydrated by default', () => {
        expect(view.hydrated()).toBe(false);
      });

      it('should be able to be hydrated and dehydrated', () => {
        var ctx = new Object();
        view.hydrate(null, null, ctx);
        expect(view.hydrated()).toBe(true);

        view.dehydrate();
        expect(view.hydrated()).toBe(false);
      });
    });

    describe('with locals', function() {
      var view;
      beforeEach(() => {
        var pv = new ProtoView(el('<div id="1"></div>'), new ProtoChangeDetector());
        pv.bindVariable('context-foo', 'template-foo');
        view = createView(pv);
      });

      it('should support setting of declared locals', () => {
        view.setLocal('context-foo', 'bar');
        expect(view.context.get('template-foo')).toBe('bar');
      });

      it('should throw on undeclared locals', () => {
        expect(() => view.setLocal('setMePlease', 'bar')).toThrowError();
      });

      it('when dehydrated should set locals to null', () => {
        view.setLocal('context-foo', 'bar');
        view.dehydrate();
        view.hydrate(null, null, new Object());
        expect(view.context.get('template-foo')).toBe(null);
      });

      it('should throw when trying to set on dehydrated view', () => {
        view.dehydrate();
        expect(() => view.setLocal('context-foo', 'bar')).toThrowError();
      });
    });

    describe('instatiated and hydrated', function() {

      function createCollectDomNodesTestCases(useTemplateElement:boolean) {

        function templateAwareCreateElement(html) {
          return el(useTemplateElement ? `<template>${html}</template>` : html);
        }

        it('should collect the root node in the ProtoView element', () => {
          var pv = new ProtoView(templateAwareCreateElement('<div id="1"></div>'), new ProtoChangeDetector());
          var view = pv.instantiate(null);
          view.hydrate(null, null, null);
          expect(view.nodes.length).toBe(1);
          expect(view.nodes[0].getAttribute('id')).toEqual('1');
        });

        describe('collect elements with property bindings', () => {

          it('should collect property bindings on the root element if it has the ng-binding class', () => {
            var pv = new ProtoView(templateAwareCreateElement('<div [prop]="a" class="ng-binding"></div>'), new ProtoChangeDetector());
            pv.bindElement(null);
            pv.bindElementProperty(parser.parseBinding('a', null), 'prop', reflector.setter('prop'));

            var view = pv.instantiate(null);
            view.hydrate(null, null, null);
            expect(view.bindElements.length).toEqual(1);
            expect(view.bindElements[0]).toBe(view.nodes[0]);
          });

          it('should collect property bindings on child elements with ng-binding class', () => {
            var pv = new ProtoView(templateAwareCreateElement('<div><span></span><span class="ng-binding"></span></div>'),
              new ProtoChangeDetector());
            pv.bindElement(null);
            pv.bindElementProperty(parser.parseBinding('b', null), 'a', reflector.setter('a'));

            var view = pv.instantiate(null);
            view.hydrate(null, null, null);
            expect(view.bindElements.length).toEqual(1);
            expect(view.bindElements[0]).toBe(view.nodes[0].childNodes[1]);
          });

        });

        describe('collect text nodes with bindings', () => {

          it('should collect text nodes under the root element', () => {
            var pv = new ProtoView(templateAwareCreateElement('<div class="ng-binding">{{}}<span></span>{{}}</div>'), new ProtoChangeDetector());
            pv.bindElement(null);
            pv.bindTextNode(0, parser.parseBinding('a', null));
            pv.bindTextNode(2, parser.parseBinding('b', null));

            var view = pv.instantiate(null);
            view.hydrate(null, null, null);
            expect(view.textNodes.length).toEqual(2);
            expect(view.textNodes[0]).toBe(view.nodes[0].childNodes[0]);
            expect(view.textNodes[1]).toBe(view.nodes[0].childNodes[2]);
          });

          it('should collect text nodes with bindings on child elements with ng-binding class', () => {
            var pv = new ProtoView(templateAwareCreateElement('<div><span> </span><span class="ng-binding">{{}}</span></div>'),
              new ProtoChangeDetector());
            pv.bindElement(null);
            pv.bindTextNode(0, parser.parseBinding('b', null));

            var view = pv.instantiate(null);
            view.hydrate(null, null, null);
            expect(view.textNodes.length).toEqual(1);
            expect(view.textNodes[0]).toBe(view.nodes[0].childNodes[1].childNodes[0]);
          });

        });
      }

      describe('inplace instantiation', () => {
        it('should be supported.', () => {
          var template = el('<div></div>');
          var pv = new ProtoView(template, new ProtoChangeDetector());
          pv.instantiateInPlace = true;
          var view = pv.instantiate(null);
          view.hydrate(null, null, null);
          expect(view.nodes[0]).toBe(template);
        });

        it('should be off by default.', () => {
          var template = el('<div></div>')
          var view = new ProtoView(template, new ProtoChangeDetector())
              .instantiate(null);
          view.hydrate(null, null, null);
          expect(view.nodes[0]).not.toBe(template);
        });
      });

      describe('collect dom nodes with a regular element as root', () => {
        createCollectDomNodesTestCases(false);
      });

      describe('collect dom nodes with a template element as root', () => {
        createCollectDomNodesTestCases(true);
      });

      describe('create ElementInjectors', () => {
        it('should use the directives of the ProtoElementInjector', () => {
          var pv = new ProtoView(el('<div class="ng-binding"></div>'), new ProtoChangeDetector());
          pv.bindElement(new ProtoElementInjector(null, 1, [SomeDirective]));

          var view = pv.instantiate(null);
          view.hydrate(null, null, null);
          expect(view.elementInjectors.length).toBe(1);
          expect(view.elementInjectors[0].get(SomeDirective) instanceof SomeDirective).toBe(true);
        });

        it('should use the correct parent', () => {
          var pv = new ProtoView(el('<div class="ng-binding"><span class="ng-binding"></span></div>'),
            new ProtoChangeDetector());
          var protoParent = new ProtoElementInjector(null, 0, [SomeDirective]);
          pv.bindElement(protoParent);
          pv.bindElement(new ProtoElementInjector(protoParent, 1, [AnotherDirective]));

          var view = pv.instantiate(null);
          view.hydrate(null, null, null);
          expect(view.elementInjectors.length).toBe(2);
          expect(view.elementInjectors[0].get(SomeDirective) instanceof SomeDirective).toBe(true);
          expect(view.elementInjectors[1].parent).toBe(view.elementInjectors[0]);
        });

        it('should not pass the host injector when a parent injector exists', () => {
          var pv = new ProtoView(el('<div class="ng-binding"><span class="ng-binding"></span></div>'),
            new ProtoChangeDetector());
          var protoParent = new ProtoElementInjector(null, 0, [SomeDirective]);
          pv.bindElement(protoParent);
          var testProtoElementInjector = new TestProtoElementInjector(protoParent, 1, [AnotherDirective]);
          pv.bindElement(testProtoElementInjector);

          var hostProtoInjector = new ProtoElementInjector(null, 0, []);
          var hostInjector = hostProtoInjector.instantiate(null, null, null);
          var view;
          expect(() => view = pv.instantiate(hostInjector)).not.toThrow();
          expect(testProtoElementInjector.parentElementInjector).toBe(view.elementInjectors[0]);
          expect(testProtoElementInjector.hostElementInjector).toBeNull();
        });

        it('should pass the host injector when there is no parent injector', () => {
          var pv = new ProtoView(el('<div class="ng-binding"><span class="ng-binding"></span></div>'),
            new ProtoChangeDetector());
          pv.bindElement(new ProtoElementInjector(null, 0, [SomeDirective]));
          var testProtoElementInjector = new TestProtoElementInjector(null, 1, [AnotherDirective]);
          pv.bindElement(testProtoElementInjector);

          var hostProtoInjector = new ProtoElementInjector(null, 0, []);
          var hostInjector = hostProtoInjector.instantiate(null, null, null);
          expect(() => pv.instantiate(hostInjector)).not.toThrow();
          expect(testProtoElementInjector.parentElementInjector).toBeNull();
          expect(testProtoElementInjector.hostElementInjector).toBe(hostInjector);
        });
      });

      describe('collect root element injectors', () => {

        it('should collect a single root element injector', () => {
          var pv = new ProtoView(el('<div class="ng-binding"><span class="ng-binding"></span></div>'),
            new ProtoChangeDetector());
          var protoParent = new ProtoElementInjector(null, 0, [SomeDirective]);
          pv.bindElement(protoParent);
          pv.bindElement(new ProtoElementInjector(protoParent, 1, [AnotherDirective]));

          var view = pv.instantiate(null);
          view.hydrate(null, null, null);
          expect(view.rootElementInjectors.length).toBe(1);
          expect(view.rootElementInjectors[0].get(SomeDirective) instanceof SomeDirective).toBe(true);
        });

        it('should collect multiple root element injectors', () => {
          var pv = new ProtoView(el('<div><span class="ng-binding"></span><span class="ng-binding"></span></div>'),
            new ProtoChangeDetector());
          pv.bindElement(new ProtoElementInjector(null, 1, [SomeDirective]));
          pv.bindElement(new ProtoElementInjector(null, 2, [AnotherDirective]));

          var view = pv.instantiate(null);
          view.hydrate(null, null, null);
          expect(view.rootElementInjectors.length).toBe(2)
          expect(view.rootElementInjectors[0].get(SomeDirective) instanceof SomeDirective).toBe(true);
          expect(view.rootElementInjectors[1].get(AnotherDirective) instanceof AnotherDirective).toBe(true);
        });

      });

      describe('with component views', () => {
        var ctx;

        function createComponentWithSubPV(subProtoView) {
          var pv = new ProtoView(el('<cmp class="ng-binding"></cmp>'), new ProtoChangeDetector());
          var binder = pv.bindElement(new ProtoElementInjector(null, 0, [SomeComponent], true));
          binder.componentDirective = someComponentDirective;
          binder.nestedProtoView = subProtoView;
          return pv;
        }

        function createNestedView(protoView) {
          ctx = new MyEvaluationContext();
          var view = protoView.instantiate(null);
          view.hydrate(new Injector([]), null, ctx);
          return view;
        }

        it('should expose component services to the component', () => {
          var subpv = new ProtoView(el('<span></span>'), new ProtoChangeDetector());
          var pv = createComponentWithSubPV(subpv);

          var view = createNestedView(pv);

          var comp = view.rootElementInjectors[0].get(SomeComponent);
          expect(comp.service).toBeAnInstanceOf(SomeService);
        });

        it('should expose component services and component instance to directives in the shadow Dom',
          () => {
            var subpv = new ProtoView(
              el('<div dec class="ng-binding">hello shadow dom</div>'), new ProtoChangeDetector());
            subpv.bindElement(
              new ProtoElementInjector(null, 0, [ServiceDependentDecorator]));
            var pv = createComponentWithSubPV(subpv);

            var view = createNestedView(pv);

            var subView = view.componentChildViews[0];
            var subInj = subView.rootElementInjectors[0];
            var subDecorator = subInj.get(ServiceDependentDecorator);
            var comp = view.rootElementInjectors[0].get(SomeComponent);

            expect(subDecorator).toBeAnInstanceOf(ServiceDependentDecorator);
            expect(subDecorator.service).toBe(comp.service);
            expect(subDecorator.component).toBe(comp);
          });

        function expectViewHasNoDirectiveInstances(view) {
          view.elementInjectors.forEach((inj) => expect(inj.hasInstances()).toBe(false));
        }

        it('dehydration should dehydrate child component views too', () => {
          var subpv = new ProtoView(
            el('<div dec class="ng-binding">hello shadow dom</div>'), new ProtoChangeDetector());
          subpv.bindElement(
            new ProtoElementInjector(null, 0, [ServiceDependentDecorator]));
          var pv = createComponentWithSubPV(subpv);

          var view = createNestedView(pv);
          view.dehydrate();

          expect(view.hydrated()).toBe(false);
          expectViewHasNoDirectiveInstances(view);
          view.componentChildViews.forEach(
            (view) => expectViewHasNoDirectiveInstances(view));
        });

        it('should create shadow dom', () => {
          var subpv = new ProtoView(el('<span>hello shadow dom</span>'), new ProtoChangeDetector());
          var pv = createComponentWithSubPV(subpv);

          var view = createNestedView(pv);

          expect(view.nodes[0].shadowRoot.childNodes[0].childNodes[0].nodeValue).toEqual('hello shadow dom');
        });

        it('should use the provided shadow DOM strategy', () => {
          var subpv = new ProtoView(el('<span>hello shadow dom</span>'), new ProtoChangeDetector());

          var pv = new ProtoView(el('<cmp class="ng-binding"></cmp>'), new ProtoChangeDetector());
          var binder = pv.bindElement(new ProtoElementInjector(null, 0, [SomeComponentWithEmulatedShadowDom], true));
          binder.componentDirective = new DirectiveMetadataReader().read(SomeComponentWithEmulatedShadowDom);
          binder.nestedProtoView = subpv;

          var view = createNestedView(pv);
          expect(view.nodes[0].childNodes[0].childNodes[0].nodeValue).toEqual('hello shadow dom');
        });

      });

      describe('with template views', () => {
        function createViewWithTemplate() {
          var templateProtoView = new ProtoView(
            el('<div id="1"></div>'), new ProtoChangeDetector());
          var pv = new ProtoView(el('<someTmpl class="ng-binding"></someTmpl>'), new ProtoChangeDetector());
          var binder = pv.bindElement(new ProtoElementInjector(null, 0, [SomeTemplate]));
          binder.templateDirective = someTemplateDirective;
          binder.nestedProtoView = templateProtoView;

          return createView(pv);
        }

        it('should create a viewPort for the template directive', () => {
          var view = createViewWithTemplate();

          var tmplComp = view.rootElementInjectors[0].get(SomeTemplate);
          expect(tmplComp.viewPort).not.toBe(null);
        });

        it('dehydration should dehydrate viewports', () => {
          var view = createViewWithTemplate();

          var tmplComp = view.rootElementInjectors[0].get(SomeTemplate);
          expect(tmplComp.viewPort.hydrated()).toBe(false);
        });
      });

      describe('event handlers', () => {
        var view, ctx, called, receivedEvent, dispatchedEvent;

        function createViewAndContext(protoView) {
          view = createView(protoView);
          ctx = view.context;
          called = 0;
          receivedEvent = null;
          ctx.callMe = (event) => {
            called += 1;
            receivedEvent = event;
          }
        }

        function dispatchClick(el) {
          dispatchedEvent = DOM.createMouseEvent('click');
          DOM.dispatchEvent(el, dispatchedEvent);
        }

        function createProtoView() {
          var pv = new ProtoView(el('<div class="ng-binding"><div></div></div>'),
            new ProtoChangeDetector());
          pv.bindElement(new TestProtoElementInjector(null, 0, []));
          pv.bindEvent('click', parser.parseBinding('callMe(\$event)', null));
          return pv;
        }

        it('should fire on non-bubbling native events', () => {
          createViewAndContext(createProtoView());

          dispatchClick(view.nodes[0]);

          expect(called).toEqual(1);
          expect(receivedEvent).toBe(dispatchedEvent);
        });

        it('should not fire on a bubbled native events', () => {
          createViewAndContext(createProtoView());

          dispatchClick(view.nodes[0].firstChild);

          // This test passes trivially on webkit browsers due to
          // https://bugs.webkit.org/show_bug.cgi?id=122755
          expect(called).toEqual(0);
        });

        it('should not throw if the view is dehydrated', () => {
          createViewAndContext(createProtoView());

          view.dehydrate();
          expect(() => dispatchClick(view.nodes[0])).not.toThrow();
          expect(called).toEqual(0);
        });

        it('should support custom event emitters', () => {
          var pv = new ProtoView(el('<div class="ng-binding"><div></div></div>'),
            new ProtoChangeDetector());
          pv.bindElement(new TestProtoElementInjector(null, 0, [EventEmitterDirective]));
          pv.bindEvent('click', parser.parseBinding('callMe(\$event)', null));

          createViewAndContext(pv);
          var dir = view.elementInjectors[0].get(EventEmitterDirective);

          var dispatchedEvent = new Object();

          dir.click(dispatchedEvent);
          expect(receivedEvent).toBe(dispatchedEvent);
          expect(called).toEqual(1);

          // Should not eval the binding, because custom emitter takes over.
          dispatchClick(view.nodes[0]);

          expect(called).toEqual(1);
        });
      });

      describe('react to record changes', () => {
        var view, cd, ctx;

        function createViewAndChangeDetector(protoView) {
          view = createView(protoView);
          ctx = view.context;
          cd = view.changeDetector;
        }

        it('should consume text node changes', () => {
          var pv = new ProtoView(el('<div class="ng-binding">{{}}</div>'),
            new ProtoChangeDetector());
          pv.bindElement(null);
          pv.bindTextNode(0, parser.parseBinding('foo', null));
          createViewAndChangeDetector(pv);

          ctx.foo = 'buz';
          cd.detectChanges();
          expect(view.textNodes[0].nodeValue).toEqual('buz');
        });

        it('should consume element binding changes', () => {
          var pv = new ProtoView(el('<div class="ng-binding"></div>'),
            new ProtoChangeDetector());
          pv.bindElement(null);
          pv.bindElementProperty(parser.parseBinding('foo', null), 'id', reflector.setter('id'));
          createViewAndChangeDetector(pv);

          ctx.foo = 'buz';
          cd.detectChanges();
          expect(view.bindElements[0].id).toEqual('buz');
        });

        it('should consume directive watch expression change', () => {
          var pv = new ProtoView(el('<div class="ng-binding"></div>'),
            new ProtoChangeDetector());
          pv.bindElement(new ProtoElementInjector(null, 0, [SomeDirective]));
          pv.bindDirectiveProperty(0, parser.parseBinding('foo', null), 'prop', reflector.setter('prop'), false);
          createViewAndChangeDetector(pv);

          ctx.foo = 'buz';
          cd.detectChanges();
          expect(view.elementInjectors[0].get(SomeDirective).prop).toEqual('buz');
        });

        it('should notify a directive about changes after all its properties have been set', () => {
          var pv = new ProtoView(el('<div class="ng-binding"></div>'),
            new ProtoChangeDetector());

          pv.bindElement(new ProtoElementInjector(null, 0, [DirectiveImplementingOnChange]));
          pv.bindDirectiveProperty( 0, parser.parseBinding('a', null), 'a', reflector.setter('a'), false);
          pv.bindDirectiveProperty( 0, parser.parseBinding('b', null), 'b', reflector.setter('b'), false);
          createViewAndChangeDetector(pv);

          ctx.a = 100;
          ctx.b = 200;
          cd.detectChanges();

          var directive = view.elementInjectors[0].get(DirectiveImplementingOnChange);
          expect(directive.c).toEqual(300);
        });

        it('should provide a map of updated properties', () => {
          var pv = new ProtoView(el('<div class="ng-binding"></div>'),
            new ProtoChangeDetector());

          pv.bindElement(new ProtoElementInjector(null, 0, [DirectiveImplementingOnChange]));
          pv.bindDirectiveProperty( 0, parser.parseBinding('a', null), 'a', reflector.setter('a'), false);
          pv.bindDirectiveProperty( 0, parser.parseBinding('b', null), 'b', reflector.setter('b'), false);
          createViewAndChangeDetector(pv);

          ctx.a = 0;
          ctx.b = 0;
          cd.detectChanges();

          ctx.a = 100;
          cd.detectChanges();

          var directive = view.elementInjectors[0].get(DirectiveImplementingOnChange);
          expect(directive.changes["a"].currentValue).toEqual(100);
          expect(directive.changes["b"]).not.toBeDefined();
        });
      });
    });

    describe('protoView createRootProtoView', () => {
      var element, pv;
      beforeEach(() => {
        element = DOM.createElement('div');
        pv = new ProtoView(el('<div>hi</div>'), new ProtoChangeDetector());
      });

      it('should create the root component when instantiated', () => {
        var rootProtoView = ProtoView.createRootProtoView(pv, element, someComponentDirective);
        var view = rootProtoView.instantiate(null);
        view.hydrate(new Injector([]), null, null);
        expect(view.rootElementInjectors[0].get(SomeComponent)).not.toBe(null);
      });

      it('should inject the protoView into the shadowDom', () => {
        var rootProtoView = ProtoView.createRootProtoView(pv, element, someComponentDirective);
        var view = rootProtoView.instantiate(null);
        view.hydrate(new Injector([]), null, null);
        expect(element.shadowRoot.childNodes[0].childNodes[0].nodeValue).toEqual('hi');
      });
    });
  });
}

class SomeDirective {
  prop;
  constructor() {
    this.prop = 'foo';
  }
}

class DirectiveImplementingOnChange extends OnChange {
  a;
  b;
  c;
  changes;

  onChange(changes) {
    this.c = this.a + this.b;
    this.changes = changes;
  }
}

class SomeService {}

@Component({
  componentServices: [SomeService]
})
class SomeComponent {
  service: SomeService;
  constructor(service: SomeService) {
    this.service = service;
  }
}

@Component({
  shadowDom: ShadowDomEmulated
})
class SomeComponentWithEmulatedShadowDom {
}

@Decorator({
  selector: '[dec]'
})
class ServiceDependentDecorator {
  component: SomeComponent;
  service: SomeService;
  constructor(component: SomeComponent, service: SomeService) {
    this.component = component;
    this.service = service;
  }
}

@Template({
  selector: 'someTmpl'
})
class SomeTemplate {
  viewPort: ViewPort;
  constructor(viewPort: ViewPort) {
    this.viewPort = viewPort;
  }
}


class AnotherDirective {
  prop:string;
  constructor() {
    this.prop = 'anotherFoo';
  }
}

class EventEmitterDirective {
  _clicker:Function;
  constructor(@EventEmitter('click') clicker:Function) {
    this._clicker = clicker;
  }
  click(eventData) {
    this._clicker(eventData);
  }
}


class MyEvaluationContext {
  foo:string;
  a;
  b;
  callMe;
  constructor() {
    this.foo = 'bar';
  };
}

class TestProtoElementInjector extends ProtoElementInjector {
  parentElementInjector: ElementInjector;
  hostElementInjector: ElementInjector;

  constructor(parent:ProtoElementInjector, index:int, bindings:List, firstBindingIsComponent:boolean = false) {
    super(parent, index, bindings, firstBindingIsComponent);
  }

  instantiate(parent:ElementInjector, host:ElementInjector, events):ElementInjector {
    this.parentElementInjector = parent;
    this.hostElementInjector = host;
    return super.instantiate(parent, host, events);
  }
}
