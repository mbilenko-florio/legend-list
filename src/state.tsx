import * as React from 'react';

// This is an implementation of a simple state management system, inspired by Legend State.
// It stores values and listeners in Maps, with peek$ and set$ functions to get and set values.
// The set$ function also triggers the listeners.
//
// This is definitely not general purpose and has one big optimization/caveat: use$ is only ever called
// once for each unique name. So we don't need to manage a Set of listeners or dispose them,
// which saves needing useEffect hooks or managing listeners in a Set.

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
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
    listeners.set(signalName, forceUpdate);

    return values.get(signalName);
}

export function peek$(ctx: ListenerContext, signalName: ListenerType) {
    const { values } = ctx;
    return values.get(signalName);
}

export function set$(ctx: ListenerContext, signalName: ListenerType, value: any) {
    const { listeners, values } = ctx;
    if (values.get(signalName) !== value) {
        values.set(signalName, value);
        listeners.get(signalName)?.();
    }
}
