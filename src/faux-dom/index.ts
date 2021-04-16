import React, { createElement, createRef } from "react";
// @ts-expect-error
import styleAttr from "style-attr";
// @ts-expect-error
import querySelectorAll from "query-selector";
import {
  isString,
  isUndefined,
  mapValues,
  styleToPropName,
  eventToPropName,
  attrToPropName,
} from "./utils";
import { ELEMENT_NODE, DOCUMENT_POSITION } from "./constants";
import { FauxNode, FauxNodeHandle } from "./component";

const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export class FauxStyle {
  style: { [key: string]: string | null };

  constructor(style: { [key: string]: string | null } = {}) {
    this.style = style;
  }

  setProperty: CSSStyleDeclaration["setProperty"] = (name, value) => {
    this.style[styleToPropName(name)] = value;
  };
  getPropertyValue: CSSStyleDeclaration["getPropertyValue"] = (name) => {
    return this.style[styleToPropName(name)] ?? "";
  };
  removeProperty: CSSStyleDeclaration["removeProperty"] = (name) => {
    const key = styleToPropName(name);
    const old = this.style[key];
    delete this.style[key];
    return old ?? "";
  };
}

export class FauxElement {
  id: string;
  ref = createRef<HTMLElement>();
  mountRef = createRef<FauxNodeHandle>();

  nodeType: number;
  nodeName: string;
  text: string;
  parentNode?: FauxElement;
  childNodes: FauxElement[];
  attrs: { [key: string]: string | null };
  style: FauxStyle;
  eventListeners: { [key: string]: string | number | undefined };

  constructor(
    nodeName: string,
    parentNode?: FauxElement,
    nodeType: number = ELEMENT_NODE,
    attrs: { [key: string]: string | null } = {},
    styles: { [key: string]: string | null } = {}
  ) {
    this.id = generateId();
    this.nodeName = nodeName;
    this.nodeType = nodeType;
    this.parentNode = parentNode;
    this.childNodes = [];
    this.text = "";
    this.attrs = attrs;
    this.style = new FauxStyle(styles);
    this.eventListeners = {};
  }

  getAttr() {
    return { ...this.attrs };
  }
  getStyle() {
    return { ...this.style.style };
  }
  unmount() {
    this.mountRef.current?.hide();
  }

  setAttribute: Element["setAttribute"] = (name, value) => {
    if (name === "style") {
      if (isString(value)) {
        const styles = styleAttr.parse(value);

        for (const key in styles) {
          const hasUpdate = this.style.getPropertyValue(key) !== styles[key];
          this.style.setProperty(key, styles[key]);
          if (this.ref.current && hasUpdate) {
            this.ref.current.style.setProperty(key, styles[key]);
          }
        }
      }
    } else {
      const hasUpdate = this.getAttribute(name) !== value;
      this.attrs[attrToPropName(name)] = value;
      if (this.ref.current && hasUpdate) {
        this.ref.current.setAttribute(name, value);
      }
    }
  };
  setAttributeNS: Element["setAttributeNS"] = (ns, ...args) =>
    this.setAttribute(...args);

  getAttribute: Element["getAttribute"] = (name) => {
    return this.attrs[attrToPropName(name)];
  };
  getAttributeNS: Element["getAttributeNS"] = (ns, ...args) =>
    this.getAttribute(...args);

  getAttributeNode: Element["getAttributeNode"] = (name) => {
    const value = this.getAttribute(name);
    if (!isUndefined(value)) {
      return {
        value: value,
        specified: true,
      } as Attr;
    }
    return null;
  };
  getAttributeNodeNS: Element["getAttributeNodeNS"] = (ns, ...args) =>
    this.getAttributeNode(...args);

  removeAttribute: Element["removeAttribute"] = (name) => {
    delete this.attrs[attrToPropName(name)];
  };
  removeAttributeNS: Element["removeAttributeNS"] = (ns, ...args) =>
    this.removeAttribute(...args);

  addEventListener: Element["addEventListener"] = (name, fn) => {
    const prop = eventToPropName(name);
    this.eventListeners[prop] = this.eventListeners[prop] || [];
    this.eventListeners[prop].push(fn);
  };

  removeEventListener: Element["removeEventListener"] = (name, fn) => {
    const listeners = this.eventListeners[eventToPropName(name)];

    if (listeners) {
      const match = listeners.indexOf(fn);

      if (match !== -1) {
        listeners.splice(match, 1);
      }
    }
  };

  appendChild(el: FauxElement) {
    // if (el instanceof FauxElement) {
    el.parentNode = this;
    // }

    this.childNodes.push(el);
    return el;
  }

  insertBefore(el: FauxElement, before: FauxElement) {
    const index = this.childNodes.indexOf(before);
    el.parentNode = this;

    if (index !== -1) {
      this.childNodes.splice(index, 0, el);
    } else {
      this.childNodes.push(el);
    }

    return el;
  }

  removeChild(child: FauxElement) {
    const target = this.childNodes.indexOf(child);
    this.childNodes.splice(target, 1);
    child.unmount();
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector: string) {
    if (!selector) {
      throw new Error("Not enough arguments");
    }

    return querySelectorAll(selector, this);
  }

  getElementsByTagName(nodeName: string): FauxElement[] {
    const children = this.children;

    if (children.length === 0) {
      return [];
    } else {
      let matches;

      if (nodeName !== "*") {
        matches = children.filter((el) => el.nodeName === nodeName);
      } else {
        matches = children;
      }

      const childMatches = children.map((el) =>
        el.getElementsByTagName(nodeName)
      );

      return matches.concat.apply(matches, childMatches);
    }
  }
  getElementsByTagNameNS = (ns: string, nodeName: string) =>
    this.getElementsByTagName(nodeName);

  getElementById(id: string): FauxElement | null {
    const children = this.children;

    if (children.length === 0) {
      return null;
    } else {
      const match = children.filter((el) => el.getAttribute("id") === id)[0];

      if (match) {
        return match;
      } else {
        const childMatches = children.map((el) => el.getElementById(id));

        return childMatches.filter((match) => match !== null)[0] || null;
      }
    }
  }
  getElementByIdNS = (ns: string, id: string) => this.getElementById(id);

  getBoundingClientRect = () => {
    if (!this.ref.current) {
      return undefined;
    }

    return this.ref.current.getBoundingClientRect();
  };

  cloneNode(deep: boolean = true): FauxElement {
    const el = new FauxElement(
      this.nodeName,
      this.parentNode,
      this.nodeType,
      this.getAttr(),
      this.getStyle()
    );

    if (deep) {
      el.childNodes = this.childNodes.map((c) => {
        const childEl = c.cloneNode(true);
        childEl.parentNode = el;
        return childEl;
      });
    }
    return el;
  }

  compareDocumentPosition(other: FauxElement) {
    function getFirstNodeByOrder(
      nodes: FauxElement[],
      nodeOne: FauxElement,
      nodeTwo: FauxElement
    ): FauxElement | false {
      return nodes.reduce((result: FauxElement | false, node) => {
        if (result !== false) {
          return result;
        } else if (node === nodeOne) {
          return nodeOne;
        } else if (node === nodeTwo) {
          return nodeTwo;
        } else if (node.childNodes) {
          return getFirstNodeByOrder(node.childNodes, nodeOne, nodeTwo);
        } else {
          return false;
        }
      }, false);
    }

    function isAncestor(source: FauxElement, target: FauxElement): boolean {
      while (target.parentNode) {
        target = target.parentNode;
        if (target === source) {
          return true;
        }
      }
      return false;
    }

    function eitherContains(left: FauxElement, right: FauxElement) {
      return isAncestor(left, right)
        ? DOCUMENT_POSITION.CONTAINED_BY + DOCUMENT_POSITION.FOLLOWING
        : isAncestor(right, left)
        ? DOCUMENT_POSITION.CONTAINS + DOCUMENT_POSITION.PRECEDING
        : false;
    }

    function getRootNode(node: FauxElement) {
      while (node.parentNode) {
        node = node.parentNode;
      }
      return node;
    }

    if (this === other) {
      return 0;
    }

    const referenceRoot = getRootNode(this);
    const otherRoot = getRootNode(other);

    if (referenceRoot !== otherRoot) {
      return DOCUMENT_POSITION.DISCONNECTED;
    }

    const result = eitherContains(this, other);
    if (result) {
      return result;
    }

    const first = getFirstNodeByOrder([referenceRoot], this, other);
    return first === this
      ? DOCUMENT_POSITION.FOLLOWING
      : first === other
      ? DOCUMENT_POSITION.PRECEDING
      : DOCUMENT_POSITION.DISCONNECTED;
  }

  get nextSibling() {
    const siblings = this.parentNode?.children;
    if (!siblings) return;
    const me = siblings.indexOf(this);
    return siblings[me + 1];
  }

  get previousSibling() {
    const siblings = this.parentNode?.children;
    if (!siblings) return;
    const me = siblings.indexOf(this);
    return siblings[me - 1];
  }

  get innerHTML() {
    return this.text;
  }
  set innerHTML(text: string) {
    this.text = text;
  }

  get textContent() {
    return this.text;
  }
  set textContent(text: string) {
    this.text = text;
  }

  get children() {
    // So far nodes created by this library are all of nodeType 1 (elements),
    // but this could change in the future.
    return this.childNodes.filter((el) => {
      if (!el.nodeType) {
        // It's a React element, we always add it
        return true;
      }

      // It's a HTML node. We want to filter to have only nodes with type 1
      return el.nodeType === ELEMENT_NODE;
    });
  }

  toReact(): React.ReactNode {
    const attrs = this.getAttr();
    const style = this.getStyle();

    const self = this;

    return createElement(
      FauxNode,
      {
        ref: this.mountRef,
        key: this.id,
      },
      [
        createElement(
          this.nodeName,
          {
            ref: this.ref,
            key: this.id,
            ...attrs,
            ...mapValues(
              this.eventListeners,
              (listeners) => (syntheticEvent) => {
                let event;

                if (syntheticEvent) {
                  event = syntheticEvent.nativeEvent;
                  event.syntheticEvent = syntheticEvent;
                }

                mapValues(listeners, (listener) => {
                  listener.call(self, event);
                });
              }
            ),
            style,
          },
          this.text || this.children.map((el) => el.toReact())
        ),
      ]
    );
  }
}

const FauxWindow = {
  getComputedStyle: (node: FauxElement) => ({
    getPropertyValue: node.style.getPropertyValue,
  }),
};

const FauxDocument = {
  Element: FauxElement,
  defaultView: FauxWindow,
  createElement: (nodeName: string) => new FauxElement(nodeName),
  createElementNS: function (ns: string, nodeName: string) {
    return this.createElement(nodeName);
  },
  // The selector engine tries to validate with this, but we don't care.
  // 8 = DOCUMENT_POSITION_CONTAINS, so we say all nodes are in this document.
  compareDocumentPosition: () => DOCUMENT_POSITION.CONTAINS,
};

// @ts-expect-error
FauxElement.prototype.ownerDocument = FauxDocument;
