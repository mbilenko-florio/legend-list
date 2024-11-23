import * as React from 'react';

export type ListenerType =
    | 'numContainers'
    | `containerIndex${number}`
    | `containerPosition${number}`
    | `numItems`
    | 'totalLength'
    | 'paddingTop';

interface ListenerContext {
    listeners: Map<ListenerType, () => void>;
    values: Map<ListenerType, any>;
}

const ContextListener = React.createContext<ListenerContext | null>(null);

export function StateProvider({ children }: { children: React.ReactNode }) {
    const [value] = React.useState(() => ({
        listeners: new Map(),
        values: new Map(),
    }));
    return <ContextListener.Provider value={value}>{children}</ContextListener.Provider>;
}

export function useStateContext() {
    return React.useContext(ContextListener)!;
}

export function use$<T>(signalName: ListenerType): T {
    const { listeners, values } = React.useContext(ContextListener)!;
    const [_, setState] = React.useState(0);
    React.useMemo(() => {
        const render = () => setState((prev) => (prev > 10000 ? 0 : prev + 1));
        listeners.set(signalName, render);
    }, []);

    return values.get(signalName);
}

export function peek$(signalName: ListenerType, ctx: ListenerContext) {
    const { values } = ctx || React.useContext(ContextListener)!;
    return values.get(signalName);
}

export function set$(signalName: ListenerType, ctx: ListenerContext, value: any) {
    const { listeners, values } = ctx || React.useContext(ContextListener)!;
    if (values.get(signalName) !== value) {
        values.set(signalName, value);
        listeners.get(signalName)?.();
    }
}
