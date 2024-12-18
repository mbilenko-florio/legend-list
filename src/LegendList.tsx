// biome-ignore lint/style/useImportType: Some uses crash if importing React is missing
import * as React from "react";
import {
    type ForwardedRef,
    type ReactElement,
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Dimensions,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type ScrollView,
    StyleSheet,
} from "react-native";
import { ListComponent } from "./ListComponent";
import { USE_CONTENT_INSET } from "./constants";
import { type ListenerType, StateProvider, listen$, peek$, set$, useStateContext } from "./state";
import type { LegendListRecyclingState, LegendListRef, ViewabilityAmountCallback, ViewabilityCallback } from "./types";
import type { InternalState, LegendListProps } from "./types";
import { useInit } from "./useInit";
import { setupViewability, updateViewableItems } from "./viewability";

const DEFAULT_DRAW_DISTANCE = 250;
const INITIAL_SCROLL_ADJUST = 10000;
const POSITION_OUT_OF_VIEW = -10000000;

export const LegendList: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement =
    forwardRef(function LegendList<T>(props: LegendListProps<T>, forwardedRef: ForwardedRef<LegendListRef>) {
        return (
            <StateProvider>
                <LegendListInner {...props} ref={forwardedRef} />
            </StateProvider>
        );
    }) as never;

const LegendListInner: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement =
    forwardRef(function LegendListInner<T>(props: LegendListProps<T>, forwardedRef: ForwardedRef<LegendListRef>) {
        const {
            data,
            initialScrollIndex,
            initialScrollOffset,
            horizontal,
            initialNumContainers,
            drawDistance = 250,
            recycleItems = false,
            onEndReachedThreshold = 0.5,
            onStartReachedThreshold = 0.5,
            maintainScrollAtEnd = false,
            maintainScrollAtEndThreshold = 0.1,
            alignItemsAtEnd = false,
            maintainVisibleContentPosition = false,
            onScroll: onScrollProp,
            numColumns: numColumnsProp = 1,
            keyExtractor,
            renderItem,
            estimatedItemSize,
            getEstimatedItemSize,
            onEndReached,
            onStartReached,
            ListEmptyComponent,
            ...rest
        } = props;
        const { style, contentContainerStyle } = rest;

        const ctx = useStateContext();

        const internalRef = useRef<ScrollView>(null);
        const refScroller = internalRef as React.MutableRefObject<ScrollView>;
        const scrollBuffer = drawDistance ?? DEFAULT_DRAW_DISTANCE;

        const refState = useRef<InternalState>();
        const getId = (index: number): string => {
            const data = refState.current?.data;
            if (!data) {
                return "";
            }
            const ret = index < data.length ? (keyExtractor ? keyExtractor(data[index], index) : index) : null;
            return `${ret}`;
        };

        const getItemSize = (key: string, index: number, data: T) => {
            const sizeKnown = refState.current!.sizes.get(key)!;
            if (sizeKnown !== undefined) {
                return sizeKnown;
            }

            const size = getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize;
            // TODO: I don't think I like this setting sizes when it's not really known, how to do
            // that better and support viewability checking sizes
            refState.current!.sizes.set(key, size);
            return size;
        };
        const calculateInitialOffset = (index = initialScrollIndex) => {
            if (index) {
                let offset = 0;
                if (getEstimatedItemSize) {
                    for (let i = 0; i < index; i++) {
                        offset += getEstimatedItemSize(i, data[i]);
                    }
                } else if (estimatedItemSize) {
                    offset = index * estimatedItemSize;
                }

                return offset + (maintainVisibleContentPosition ? INITIAL_SCROLL_ADJUST : 0);
            }
            return undefined;
        };

        const initialContentOffset = initialScrollOffset ?? useMemo(calculateInitialOffset, []);

        if (!refState.current) {
            refState.current = {
                sizes: new Map(),
                positions: new Map(),
                columns: new Map(),
                pendingAdjust: 0,
                animFrameLayout: null,
                animFrameTotalSize: null,
                isStartReached: true,
                isEndReached: false,
                isAtBottom: false,
                isAtTop: false,
                data,
                idsInFirstRender: undefined as never,
                hasScrolled: false,
                scrollLength: Dimensions.get("window")[horizontal ? "width" : "height"],
                startBuffered: 0,
                startNoBuffer: 0,
                endBuffered: 0,
                endNoBuffer: 0,
                scroll: initialContentOffset || 0,
                totalSize: 0,
                timeouts: new Set(),
                viewabilityConfigCallbackPairs: undefined as never,
                renderItem: undefined as never,
                scrollAdjustPending: maintainVisibleContentPosition ? INITIAL_SCROLL_ADJUST : 0,
                nativeMarginTop: 0,
                scrollPrev: 0,
                scrollPrevTime: 0,
                scrollTime: 0,
                indexByKey: new Map(),
                scrollHistory: [],
                scrollVelocity: 0,
                contentSize: { width: 0, height: 0 },
            };
            refState.current.idsInFirstRender = new Set(data.map((_: unknown, i: number) => getId(i)));
            set$(ctx, "scrollAdjust", refState.current.scrollAdjustPending);
        }
        const adjustScroll = (diff: number) => {
            if (maintainVisibleContentPosition && refScroller.current) {
                refState.current!.scrollAdjustPending -= diff;
            }
        };
        const addTotalSize = useCallback((key: string | null, add: number) => {
            const state = refState.current!;
            const index = key === null ? 0 : state.indexByKey.get(key)!;
            const isAbove = key !== null && index < (state.startNoBuffer || 0);
            const prev = state.totalSize;
            if (key === null) {
                state.totalSize = add;
            } else {
                state.totalSize += add;
            }
            const doAdd = () => {
                const totalSize = state.totalSize;
                state.animFrameTotalSize = null;

                set$(ctx, "totalSize", totalSize);

                if (alignItemsAtEnd) {
                    doUpdatePaddingTop();
                }
            };

            if (isAbove) {
                adjustScroll(add);
            }

            if (!prev || key === null) {
                doAdd();
            } else if (!state.animFrameTotalSize) {
                state.animFrameTotalSize = requestAnimationFrame(doAdd);
            }
        }, []);

        const calculateItemsInView = useCallback((speed = 0) => {
            const state = refState.current!;
            const {
                data,
                scrollLength,
                scroll: scrollState,
                startBuffered: startBufferedState,
                positions,
                columns,
            } = state!;
            if (state.animFrameLayout) {
                cancelAnimationFrame(state.animFrameLayout);
                state.animFrameLayout = null;
            }
            if (!data) {
                return;
            }
            const topPad = (peek$<number>(ctx, "stylePaddingTop") || 0) + (peek$<number>(ctx, "headerSize") || 0);
            const scrollAdjustPending = state!.scrollAdjustPending ?? 0;
            const scrollExtra = Math.max(-16, Math.min(16, speed)) * 32;
            const scroll = Math.max(
                0,
                scrollState - topPad - (USE_CONTENT_INSET ? scrollAdjustPending : 0) + scrollExtra,
            );

            let startNoBuffer: number | null = null;
            let startBuffered: number | null = null;
            let endNoBuffer: number | null = null;
            let endBuffered: number | null = null;

            // Go backwards from the last start position to find the first item that is in view
            // This is an optimization to avoid looping through all items, which could slow down
            // when scrolling at the end of a long list.

            // TODO: Fix this logic for numColumns
            let loopStart = startBufferedState || 0;
            if (startBufferedState) {
                for (let i = startBufferedState; i >= 0; i--) {
                    const id = getId(i)!;
                    const top = positions.get(id)!;
                    if (top !== undefined) {
                        const size = getItemSize(id, i, data[i]);
                        const bottom = top + size;
                        if (bottom > scroll - scrollBuffer) {
                            loopStart = i;
                        } else {
                            break;
                        }
                    }
                }
            }

            const numColumns = peek$<number>(ctx, "numColumns");
            const loopStartMod = loopStart % numColumns;
            if (loopStartMod > 0) {
                loopStart -= loopStartMod;
            }

            let top = loopStart > 0 ? positions.get(getId(loopStart))! : 0;

            let column = 1;
            let maxSizeInRow = 0;

            for (let i = loopStart; i < data!.length; i++) {
                const id = getId(i)!;
                const size = getItemSize(id, i, data[i]);

                maxSizeInRow = Math.max(maxSizeInRow, size);

                if (positions.get(id) !== top) {
                    positions.set(id, top);
                }

                if (columns.get(id) !== column) {
                    columns.set(id, column);
                }

                if (startNoBuffer === null && top + size > scroll) {
                    startNoBuffer = i;
                }
                if (startBuffered === null && top + size > scroll - scrollBuffer) {
                    startBuffered = i;
                }
                if (startNoBuffer !== null) {
                    if (top <= scroll + scrollLength) {
                        endNoBuffer = i;
                    }
                    if (top <= scroll + scrollLength + scrollBuffer) {
                        endBuffered = i;
                    } else {
                        break;
                    }
                }

                column++;
                if (column > numColumns) {
                    top += maxSizeInRow;
                    column = 1;
                    maxSizeInRow = 0;
                }
            }

            Object.assign(refState.current!, {
                startBuffered,
                startNoBuffer,
                endBuffered,
                endNoBuffer,
            });

            // console.log("start", startBuffered, startNoBuffer, endNoBuffer, endBuffered, scroll);

            if (startBuffered !== null && endBuffered !== null) {
                const prevNumContainers = ctx.values.get("numContainers") as number;
                let numContainers = prevNumContainers;
                for (let i = startBuffered; i <= endBuffered; i++) {
                    let isContained = false;
                    const id = getId(i)!;
                    // See if this item is already in a container
                    for (let j = 0; j < numContainers; j++) {
                        const key = peek$(ctx, `containerItemKey${j}`);
                        if (key === id) {
                            isContained = true;
                            break;
                        }
                    }
                    // If it's not in a container, then we need to recycle a container out of view
                    if (!isContained) {
                        const top = (positions.get(id) || 0) + scrollAdjustPending;
                        let furthestIndex = -1;
                        let furthestDistance = 0;
                        // Find the furthest container so we can recycle a container from the other side of scroll
                        // to reduce empty container flashing when switching directions
                        // Note that since this is only checking top it may not be 100% accurate but that's fine.

                        for (let u = 0; u < numContainers; u++) {
                            const key = peek$<string>(ctx, `containerItemKey${u}`);
                            // Hasn't been allocated yet, just use it
                            if (key === undefined) {
                                furthestIndex = u;
                                break;
                            }

                            const index = refState.current?.indexByKey.get(key)!;
                            const pos = peek$<number>(ctx, `containerPosition${u}`);

                            if (index < startBuffered || index > endBuffered) {
                                const distance = Math.abs(pos - top);
                                if (index < 0 || distance > furthestDistance) {
                                    furthestDistance = distance;
                                    furthestIndex = u;
                                }
                            }
                        }
                        if (furthestIndex >= 0) {
                            set$(ctx, `containerItemKey${furthestIndex}`, id);
                        } else {
                            const containerId = numContainers;

                            numContainers++;
                            set$(ctx, `containerItemKey${containerId}`, id);

                            // TODO: This may not be necessary as it'll get a new one in the next loop?
                            set$(ctx, `containerPosition${containerId}`, POSITION_OUT_OF_VIEW);
                            set$(ctx, `containerColumn${containerId}`, -1);

                            if (__DEV__ && numContainers > peek$<number>(ctx, "numContainersPooled")) {
                                console.warn(
                                    "[legend-list] No container to recycle, consider increasing initialContainers or estimatedItemSize. numContainers:",
                                    numContainers,
                                );
                            }
                        }
                    }
                }

                if (numContainers !== prevNumContainers) {
                    set$(ctx, "numContainers", numContainers);
                    if (numContainers > peek$<number>(ctx, "numContainersPooled")) {
                        set$(ctx, "numContainersPooled", numContainers);
                    }
                }

                // Update top positions of all containers
                // TODO: This could be optimized to only update the containers that have changed
                // but it likely would have little impact. Remove this comment if not worth doing.
                for (let i = 0; i < numContainers; i++) {
                    const itemKey = peek$<string>(ctx, `containerItemKey${i}`);
                    const itemIndex = refState.current?.indexByKey.get(itemKey)!;
                    const item = data[itemIndex];
                    if (item) {
                        const id = getId(itemIndex);
                        if (!(itemKey !== id || itemIndex < startBuffered || itemIndex > endBuffered)) {
                            const pos = (positions.get(id) || 0) + scrollAdjustPending;
                            const column = columns.get(id) || 1;
                            const prevPos = peek$(ctx, `containerPosition${i}`);
                            const prevColumn = peek$(ctx, `containerColumn${i}`);

                            if (pos >= 0 && pos !== prevPos) {
                                set$(ctx, `containerPosition${i}`, pos);
                            }
                            if (column >= 0 && column !== prevColumn) {
                                set$(ctx, `containerColumn${i}`, column);
                            }
                        }
                    }
                }
            }

            if (refState.current!.viewabilityConfigCallbackPairs) {
                updateViewableItems(
                    refState.current!,
                    ctx,
                    refState.current!.viewabilityConfigCallbackPairs,
                    getId,
                    scrollLength,
                    startNoBuffer!,
                    endNoBuffer!,
                );
            }
        }, []);

        const doUpdatePaddingTop = () => {
            if (alignItemsAtEnd) {
                const { scrollLength, totalSize } = refState.current!;
                const listPaddingTop = peek$<number>(ctx, "stylePaddingTop") || 0;
                const paddingTop = Math.max(0, Math.floor(scrollLength - totalSize - listPaddingTop));
                set$(ctx, "paddingTop", paddingTop);
            }
        };

        const doMaintainScrollAtEnd = (animated: boolean) => {
            if (refState.current?.isAtBottom && maintainScrollAtEnd) {
                // TODO: This kinda works, but with a flash. Since setNativeProps is less ideal we'll favor the animated one for now.
                // scrollRef.current?.setNativeProps({
                //   contentContainerStyle: {
                //     height:
                //       visibleRange$.totalSize.get() + visibleRange$.topPad.get() + 48,
                //   },
                //   contentOffset: {
                //     y:
                //       visibleRange$.totalSize.peek() +
                //       visibleRange$.topPad.peek() -
                //       SCREEN_LENGTH +
                //       48 * 3,
                //   },
                // });

                // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
                refState.current.scroll = refState.current.totalSize - refState.current.scrollLength;

                // TODO: This kinda works too, but with more of a flash
                requestAnimationFrame(() => {
                    refScroller.current?.scrollToEnd({
                        animated,
                    });
                });
            }
        };

        const checkAtBottom = () => {
            if (!refState.current) {
                return;
            }
            const { scrollLength, scroll, contentSize } = refState.current;
            // Check if at end
            const distanceFromEnd = contentSize[horizontal ? "width" : "height"] - scroll - scrollLength;
            if (refState.current) {
                refState.current.isAtBottom = distanceFromEnd < scrollLength * maintainScrollAtEndThreshold;
            }

            if (onEndReached) {
                if (!refState.current.isEndReached) {
                    if (distanceFromEnd < onEndReachedThreshold! * scrollLength) {
                        refState.current.isEndReached = true;
                        onEndReached({ distanceFromEnd });
                    }
                } else {
                    // reset flag when user scrolls back up
                    if (distanceFromEnd >= onEndReachedThreshold! * scrollLength) {
                        refState.current.isEndReached = false;
                    }
                }
            }
        };

        const checkAtTop = () => {
            if (!refState.current) {
                return;
            }
            const { scrollLength, scroll } = refState.current;
            const scrollAdjust = peek$<number>(ctx, "scrollAdjust") || 0;
            const distanceFromTop = scroll - scrollAdjust;
            refState.current.isAtTop = distanceFromTop < 0;

            if (onStartReached) {
                if (!refState.current.isStartReached) {
                    if (distanceFromTop < onStartReachedThreshold! * scrollLength) {
                        refState.current.isStartReached = true;
                        onStartReached({ distanceFromStart: scroll });
                    }
                } else {
                    // reset flag when user scrolls back down
                    if (distanceFromTop >= onStartReachedThreshold! * scrollLength) {
                        refState.current.isStartReached = false;
                    }
                }
            }
        };

        const isFirst = !refState.current.renderItem;
        // Run first time and whenever data changes
        if (isFirst || data !== refState.current.data || numColumnsProp !== peek$<number>(ctx, "numColumns")) {
            refState.current.data = data;
            let totalSize = 0;
            const indexByKey = new Map();
            let column = 1;
            let maxSizeInRow = 0;
            for (let i = 0; i < data.length; i++) {
                const key = getId(i);
                indexByKey.set(key, i);
                const size = getItemSize(key, i, data[i]);
                maxSizeInRow = Math.max(maxSizeInRow, size);

                if (
                    maintainVisibleContentPosition &&
                    i < refState.current.startNoBuffer &&
                    !refState.current.indexByKey.has(key)
                ) {
                    // This maintains position when items are added by adding the estimated size to the top padding
                    const size = getItemSize(key, i, data[i]);
                    adjustScroll(size);
                }

                column++;
                if (column > numColumnsProp) {
                    totalSize += maxSizeInRow;
                    column = 1;
                    maxSizeInRow = 0;
                }
            }
            addTotalSize(null, totalSize);

            if (maintainVisibleContentPosition) {
                // This maintains positions when items are removed by removing their size from the top padding
                for (const [key, index] of refState.current.indexByKey) {
                    if (index < refState.current.startNoBuffer && !indexByKey.has(key)) {
                        const size = refState.current.sizes.get(key) ?? 0;
                        if (size) {
                            adjustScroll(-size);
                        }
                    }
                }
            }

            refState.current.indexByKey = indexByKey;

            if (!isFirst) {
                refState.current.isEndReached = false;
                // Reset containers that aren't used anymore because the data has changed
                const numContainers = peek$<number>(ctx, "numContainers");
                for (let i = 0; i < numContainers; i++) {
                    set$(ctx, `containerItemKey${i}`, undefined);
                    set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                    set$(ctx, `containerColumn${i}`, -1);
                }
                calculateItemsInView();

                doMaintainScrollAtEnd(false);
                checkAtTop();
                checkAtBottom();
            }
        }
        refState.current.renderItem = renderItem!;
        set$(ctx, "lastItemKey", getId(data[data.length - 1]));
        set$(ctx, "numColumns", numColumnsProp);
        // TODO: This needs to support horizontal and other ways of defining padding
        set$(
            ctx,
            "stylePaddingTop",
            StyleSheet.flatten(style)?.paddingTop ?? StyleSheet.flatten(contentContainerStyle)?.paddingTop ?? 0,
        );

        const getRenderedItem = useCallback((key: string, containerId: number) => {
            const state = refState.current;
            if (!state) {
                return null;
            }

            const { data, indexByKey } = state;

            const index = indexByKey.get(key);

            if (index === undefined) {
                return null;
            }

            const useViewability = (configId: string, callback: ViewabilityCallback) => {
                const key = containerId + configId;

                useInit(() => {
                    const value = ctx.mapViewabilityValues.get(key);
                    if (value) {
                        callback(value);
                    }
                });

                ctx.mapViewabilityCallbacks.set(key, callback);

                useEffect(
                    () => () => {
                        ctx.mapViewabilityCallbacks.delete(key);
                    },
                    [],
                );
            };
            const useViewabilityAmount = (callback: ViewabilityAmountCallback) => {
                useInit(() => {
                    const value = ctx.mapViewabilityAmountValues.get(containerId);
                    if (value) {
                        callback(value);
                    }
                });

                ctx.mapViewabilityAmountCallbacks.set(containerId, callback);

                useEffect(
                    () => () => {
                        ctx.mapViewabilityAmountCallbacks.delete(containerId);
                    },
                    [],
                );
            };
            const useRecyclingEffect = (effect: (info: LegendListRecyclingState<unknown>) => void | (() => void)) => {
                useEffect(() => {
                    const state = refState.current!;
                    let prevIndex = index;
                    let prevItem = state.data[index];
                    const signal: ListenerType = `containerItemKey${containerId}`;

                    const run = () => {
                        const data = state.data;
                        if (data) {
                            const newKey = peek$<string>(ctx, signal);
                            const newIndex = state.indexByKey.get(newKey)!;
                            const newItem = data[newIndex];
                            if (newItem) {
                                effect({
                                    index: newIndex,
                                    item: newItem,
                                    prevIndex: prevIndex,
                                    prevItem: prevItem,
                                });
                            }

                            prevIndex = newIndex;
                            prevItem = newItem;
                        }
                    };

                    run();
                    listen$(ctx, signal, run);
                }, []);
            };
            const useRecyclingState = (updateState: (info: LegendListRecyclingState<unknown>) => any) => {
                const stateInfo = useState(() =>
                    updateState({
                        index,
                        item: refState.current!.data[index],
                        prevIndex: undefined,
                        prevItem: undefined,
                    }),
                );

                useRecyclingEffect((state) => {
                    const newState = updateState(state);
                    stateInfo[1](newState);
                });

                return stateInfo;
            };

            const renderedItem = refState.current!.renderItem?.({
                item: data[index],
                index,
                useViewability,
                useViewabilityAmount,
                useRecyclingEffect,
                useRecyclingState,
            });

            return renderedItem;
        }, []);

        useInit(() => {
            refState.current!.viewabilityConfigCallbackPairs = setupViewability(props);

            // Allocate containers
            const scrollLength = refState.current!.scrollLength;
            const averageItemSize = estimatedItemSize ?? getEstimatedItemSize?.(0, data[0]);
            const numContainers =
                (initialNumContainers || Math.ceil((scrollLength + scrollBuffer * 2) / averageItemSize)) *
                numColumnsProp;

            for (let i = 0; i < numContainers; i++) {
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${i}`, -1);
            }

            set$(ctx, "numContainers", numContainers);
            set$(ctx, "numContainersPooled", numContainers * 2);

            calculateItemsInView();
        });

        const updateItemSize = useCallback((key: string, size: number) => {
            const data = refState.current?.data;
            if (!data) {
                return;
            }
            const { sizes, indexByKey, idsInFirstRender, columns } = refState.current!;
            const index = indexByKey.get(key)!;
            // TODO: I don't love this, can do it better?
            const wasInFirstRender = idsInFirstRender.has(key);

            const prevSize = sizes.get(key) || (wasInFirstRender ? getItemSize(key, index, data[index]) : 0);

            if (!prevSize || Math.abs(prevSize - size) > 0.5) {
                let diff: number;
                const numColumns = peek$<number>(ctx, "numColumns");
                if (numColumns > 1) {
                    const column = columns.get(key);
                    const loopStart = index - (column! - 1);
                    let prevMaxSizeInRow = 0;

                    // TODO: Can probably reduce duplication and do this more efficiently
                    // but it works for now.
                    for (let i = loopStart; i < loopStart + numColumns; i++) {
                        const id = getId(i)!;
                        const size = getItemSize(id, i, data[i]);
                        prevMaxSizeInRow = Math.max(prevMaxSizeInRow, size);
                    }

                    sizes.set(key, size);

                    let nextMaxSizeInRow = 0;
                    for (let i = loopStart; i < loopStart + numColumns; i++) {
                        const id = getId(i)!;
                        const size = getItemSize(id, i, data[i]);
                        nextMaxSizeInRow = Math.max(nextMaxSizeInRow, size);
                    }

                    diff = nextMaxSizeInRow - prevMaxSizeInRow;
                } else {
                    sizes.set(key, size);
                    diff = size - prevSize;
                }

                addTotalSize(key, diff);

                doMaintainScrollAtEnd(true);

                // TODO: Could this be optimized to only calculate items in view that have changed?
                const state = refState.current!;
                const scrollVelocity = state.scrollVelocity;
                // Calculate positions if not currently scrolling and have a calculate already pending
                if (!state.animFrameLayout && (Number.isNaN(scrollVelocity) || Math.abs(scrollVelocity) < 1)) {
                    state.animFrameLayout = requestAnimationFrame(() => {
                        state.animFrameLayout = null;
                        calculateItemsInView(state.scrollVelocity);
                    });
                }
            }
        }, []);

        const handleScrollDebounced = useCallback((velocity: number) => {
            const scrollAdjustPending = refState.current?.scrollAdjustPending ?? 0;
            set$(ctx, "scrollAdjust", scrollAdjustPending);

            // Use velocity to predict scroll position
            calculateItemsInView(velocity);
            checkAtBottom();
            checkAtTop();
        }, []);

        const onLayout = useCallback((event: LayoutChangeEvent) => {
            let scrollLength = event.nativeEvent.layout[horizontal ? "width" : "height"];

            if (!USE_CONTENT_INSET) {
                // Add the adjusted scroll, see $ScrollView for where this is applied
                scrollLength += event.nativeEvent.layout[horizontal ? "x" : "y"];
            }
            refState.current!.scrollLength = scrollLength;

            if (refState.current!.hasScrolled) {
                doMaintainScrollAtEnd(false);
                doUpdatePaddingTop();
                checkAtBottom();
                checkAtTop();
            }
            if (__DEV__) {
                const isWidthZero = event.nativeEvent.layout.width === 0;
                const isHeightZero = event.nativeEvent.layout.height === 0;
                if (isWidthZero || isHeightZero) {
                    console.warn(
                        `[legend-list] List ${isWidthZero ? "width" : "height"} is 0. You may need to set a style or \`flex: \` for the list, because children are absolutely positioned.`,
                    );
                }
            }
        }, []);

        const handleScroll = useCallback(
            (
                event: {
                    nativeEvent: NativeScrollEvent;
                },
                fromSelf?: boolean,
            ) => {
                if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
                    return;
                }

                const state = refState.current!;
                state.hasScrolled = true;
                state.contentSize = event.nativeEvent.contentSize;
                const currentTime = performance.now();
                const newScroll = event.nativeEvent.contentOffset[horizontal ? "x" : "y"];

                // Update scroll history
                state.scrollHistory.push({ scroll: newScroll, time: currentTime });
                // Keep only last 5 entries
                if (state.scrollHistory.length > 5) {
                    state.scrollHistory.shift();
                }

                // Calculate average velocity from history
                let velocity = 0;
                if (state.scrollHistory.length >= 2) {
                    const newest = state.scrollHistory[state.scrollHistory.length - 1];
                    const oldest = state.scrollHistory[0];
                    const scrollDiff = newest.scroll - oldest.scroll;
                    const timeDiff = newest.time - oldest.time;
                    velocity = timeDiff > 0 ? scrollDiff / timeDiff : 0;
                }

                // Update current scroll state
                state.scrollPrev = state.scroll;
                state.scrollPrevTime = state.scrollTime;
                state.scroll = newScroll;
                state.scrollTime = currentTime;
                state.scrollVelocity = velocity;
                // Pass velocity to calculateItemsInView
                handleScrollDebounced(velocity);

                if (!fromSelf) {
                    onScrollProp?.(event as NativeSyntheticEvent<NativeScrollEvent>);
                }
            },
            [],
        );

        useImperativeHandle(
            forwardedRef,
            () => {
                const scrollToIndex = ({ index, animated }: Parameters<LegendListRef["scrollToIndex"]>[0]) => {
                    // naive implementation to search element by index
                    // TODO: create some accurate search algorithm
                    const offsetObj = calculateInitialOffset(index);
                    const offset = horizontal ? { x: offsetObj, y: 0 } : { x: 0, y: offsetObj };
                    refScroller.current!.scrollTo({ ...offset, animated });
                };
                return {
                    getNativeScrollRef: () => refScroller.current!,
                    getScrollableNode: refScroller.current!.getScrollableNode,
                    getScrollResponder: refScroller.current!.getScrollResponder,
                    flashScrollIndicators: refScroller.current!.flashScrollIndicators,
                    scrollToIndex,
                    scrollToOffset: ({ offset, animated }) => {
                        const offsetObj = horizontal ? { x: offset, y: 0 } : { x: 0, y: offset };
                        refScroller.current!.scrollTo({ ...offsetObj, animated });
                    },
                    scrollToItem: ({ item, animated }) => {
                        const index = data.indexOf(item);
                        if (index !== -1) {
                            scrollToIndex({ index, animated });
                        }
                    },
                    scrollToEnd: refScroller.current!.scrollToEnd,
                };
            },
            [],
        );

        return (
            <ListComponent
                {...rest}
                horizontal={horizontal!}
                refScroller={refScroller}
                initialContentOffset={initialContentOffset}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                handleScroll={handleScroll}
                onLayout={onLayout}
                recycleItems={recycleItems}
                alignItemsAtEnd={alignItemsAtEnd}
                addTotalSize={addTotalSize}
                ListEmptyComponent={data.length === 0 ? ListEmptyComponent : undefined}
            />
        );
    }) as <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement;
