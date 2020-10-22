import React, { useEffect, useRef } from "react";
import * as d3 from "d3-selection";

type Props = {
  type: string | React.JSXElementConstructor<any>;
  children: React.ReactNode;
  [key: string]: any;
};

export const Elem = React.memo(({ type, children, ...props }: Props) => {
  const vDomRef = useRef(d3.select(document.createElement("div")));
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (typeof type !== "string") {
      return;
    }
    const el = d3.select(ref.current).data([props]).select(`rd-${type}`);

    // TODO enter
    const enter = el.enter().append(`rd-${type}`);

    // TODO update
    const update = enter.merge(el);
    Object.entries(props).forEach(([key, val]) => {
      key = key.toLowerCase();
      if (key === "className") {
      } else if (typeof val === "function") {
        if (key.startsWith("on")) {
        } else {
        }
      } else {
        update.attr(key, val);
      }
    });
    // TODO exit
    const exit = el.exit();
    exit.remove();
  }, [props]);

  return React.createElement(type, { ...props, ref }, children);
});
