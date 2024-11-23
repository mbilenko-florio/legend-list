import * as React from 'react';
import { ForwardedRef, forwardRef, ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Dimensions,
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { ListComponent } from './ListComponent';
import { peek$, set$, StateProvider, useStateContext } from './state';
import type { LegendListProps } from './types';

const DEFAULT_SCROLL_BUFFER = 0;
const POSITION_OUT_OF_VIEW = -10000;

export const LegendList: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<ScrollView> }) => ReactElement =
    forwardRef(function LegendList<T>(props: LegendListProps<T>, forwardedRef: ForwardedRef<ScrollView>) {
        return (
            <StateProvider>
                <LegendListInner {...props} ref={forwardedRef} />
            </StateProvider>
        );
    }) as any;

const LegendListInner: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<ScrollView> }) => ReactElement = forwardRef(
    function LegendListInner<T>(props: LegendListProps<T>, forwardedRef: ForwardedRef<ScrollView>) {
        const {
            data,
            initialScrollIndex,
            initialScrollOffset,
            horizontal,
            style: styleProp,
            contentContainerStyle: contentContainerStyleProp,
            initialNumContainers,
            drawDistance,
            recycleItems = true,
            onEndReachedThreshold = 0.5,
            maintainScrollAtEnd = false,
            maintainScrollAtEndThreshold = 0.1,
            alignItemsAtEnd = false,
            onScroll: onScrollProp,
            keyExtractor,
            renderItem,
            estimatedItemSize,
            getEstimatedItemSize,
            onEndReached,
            onViewableRangeChanged,
            ...rest
        } = props;

        const ctx = useStateContext();

        const internalRef = useRef<ScrollView>(null);
        const refScroller = (forwardedRef || internalRef) as React.MutableRefObject<ScrollView>;
        const scrollBuffer = drawDistance ?? DEFAULT_SCROLL_BUFFER;
        // Experimental: It works ok on iOS when scrolling up, but is doing weird things when sizes are changing.
        // And it doesn't work at all on Android because it uses contentInset. I'll try it again later.
        // Ideally it would work by adjusting the contentOffset but in previous attempts that was causing jitter.
        const supportsEstimationAdjustment = false; //   Platform.OS === "ios";

        const styleFlattened = StyleSheet.flatten(styleProp);
        const style = useMemo(() => styleFlattened, [JSON.stringify(styleProp)]);
        const contentContainerStyleFlattened = StyleSheet.flatten(contentContainerStyleProp);
        const contentContainerStyle = useMemo(
            () => contentContainerStyleFlattened,
            [JSON.stringify(contentContainerStyleProp)],
        );

        const refState = useRef<{
            positions: Map<string, number>;
            lengths: Map<String, number>;
            pendingAdjust: number;
            animFrame: number | null;
            isStartReached: boolean;
            isEndReached: boolean;
            isAtBottom: boolean;
            data: T[];
            idsInFirstRender: Set<string>;
            hasScrolled: boolean;
            scrollLength: number;
            startBuffered: number;
            startNoBuffer: number;
            endBuffered: number;
            endNoBuffer: number;
            scroll: number;
            topPad: number;
        }>();
        const getId = (index: number): string => {
            const data = refState.current?.data;
            if (!data) {
                return '';
            }
            const ret = index < data.length ? (keyExtractor ? keyExtractor(data[index], index) : index) : null;
            return ret + '';
        };

        const getItemLength = (index: number, data: T) => {
            return getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize;
        };
        const calculateInitialOffset = () => {
            if (initialScrollIndex) {
                if (getEstimatedItemSize) {
                    let offset = 0;
                    for (let i = 0; i < initialScrollIndex; i++) {
                        offset += getEstimatedItemSize(i, data[i]);
                    }
                    return offset;
                } else if (estimatedItemSize) {
                    return initialScrollIndex * estimatedItemSize;
                }
            }
            return undefined;
        };

        const initialContentOffset =
            initialScrollOffset ?? useMemo(calculateInitialOffset, [initialScrollIndex, estimatedItemSize]);

        if (!refState.current) {
            refState.current = {
                lengths: new Map(),
                positions: new Map(),
                pendingAdjust: 0,
                animFrame: null,
                isStartReached: false,
                isEndReached: false,
                isAtBottom: false,
                data: data,
                idsInFirstRender: undefined as any,
                hasScrolled: false,
                scrollLength: Dimensions.get('window')[horizontal ? 'width' : 'height'],
                startBuffered: 0,
                startNoBuffer: 0,
                endBuffered: 0,
                endNoBuffer: 0,
                scroll: initialContentOffset || 0,
                topPad: 0,
            };
            refState.current.idsInFirstRender = new Set(data.map((_: any, i: number) => getId(i)));
        }
        refState.current.data = data;
        set$(ctx, `numItems`, data.length);

        const setTotalLength = (length: number) => {
            set$(ctx, `totalLength`, length);
            const screenLength = refState.current!.scrollLength;
            if (alignItemsAtEnd) {
                const listPaddingTop =
                    ((style as any)?.paddingTop || 0) + ((contentContainerStyle as any)?.paddingTop || 0);
                set$(ctx, `paddingTop`, Math.max(0, screenLength - length - listPaddingTop));
            }
        };

        const allocateContainers = useCallback(() => {
            const scrollLength = refState.current!.scrollLength;
            const numContainers =
                initialNumContainers || Math.ceil((scrollLength + scrollBuffer * 2) / estimatedItemSize) + 4;

            for (let i = 0; i < numContainers; i++) {
                set$(ctx, `containerIndex${i}`, -1);
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
            }

            set$(ctx, `numContainers`, numContainers);
        }, []);

        const getRenderedItem = useCallback(
            (index: number) => {
                const data = refState.current?.data;
                if (!data) {
                    return null;
                }
                const renderedItem = renderItem?.({
                    item: data[index],
                    index,
                } as any);

                return renderedItem;
            },
            [renderItem],
        );

        const calculateItemsInView = useCallback(() => {
            const {
                data,
                scrollLength,
                scroll: scrollState,
                topPad,
                startNoBuffer: startNoBufferState,
                startBuffered: startBufferedState,
                endNoBuffer: endNoBufferState,
                endBuffered: endBufferedState,
            } = refState.current!;
            if (!data) {
                return;
            }
            const scroll = scrollState - topPad;

            const { lengths, positions } = refState.current!;

            let top = 0;
            let startNoBuffer: number | null = null;
            let startBuffered: number | null = null;
            let endNoBuffer: number | null = null;
            let endBuffered: number | null = null;

            // TODO: This could be optimized to not start at 0, to go backwards from previous start position
            for (let i = 0; i < data!.length; i++) {
                const id = getId(i)!;
                const length = lengths.get(id) ?? getItemLength(i, data[i]);

                if (positions.get(id) !== top) {
                    positions.set(id, top);
                }

                if (startNoBuffer === null && top + length > scroll) {
                    startNoBuffer = i;
                }
                if (startBuffered === null && top + length > scroll - scrollBuffer) {
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

                top += length;
            }

            Object.assign(refState.current!, {
                startBuffered,
                startNoBuffer,
                endBuffered,
                endNoBuffer,
            });

            if (startBuffered !== null && endBuffered !== null) {
                const prevNumContainers = ctx.values.get('numContainers');
                let numContainers = prevNumContainers;
                for (let i = startBuffered; i <= endBuffered; i++) {
                    let isContained = false;
                    // See if this item is already in a container
                    for (let j = 0; j < numContainers; j++) {
                        const index = peek$(ctx, `containerIndex${j}`);
                        if (index === i) {
                            isContained = true;
                            break;
                        }
                    }
                    // If it's not in a container, then we need to recycle a container out of view
                    if (!isContained) {
                        let didRecycle = false;
                        for (let u = 0; u < numContainers; u++) {
                            const index = peek$(ctx, `containerIndex${u}`);

                            if (index < startBuffered || index > endBuffered) {
                                set$(ctx, `containerIndex${u}`, i);
                                didRecycle = true;
                                break;
                            }
                        }
                        if (!didRecycle) {
                            if (__DEV__) {
                                console.warn(
                                    '[legend-list] No container to recycle, consider increasing initialContainers or estimatedItemLength',
                                    i,
                                );
                            }
                            const id = numContainers;
                            numContainers++;
                            set$(ctx, `containerIndex${id}`, i);
                            set$(ctx, `containerPosition${id}`, POSITION_OUT_OF_VIEW);
                        }
                    }
                }

                if (numContainers !== prevNumContainers) {
                    set$(ctx, `numContainers`, numContainers);
                }

                // Update top positions of all containers
                // TODO: This could be optimized to only update the containers that have changed
                // but it likely would have little impact. Remove this comment if not worth doing.
                for (let i = 0; i < numContainers; i++) {
                    const itemIndex = peek$(ctx, `containerIndex${i}`);
                    const item = data[itemIndex];
                    if (item) {
                        const id = getId(itemIndex);
                        if (itemIndex < startBuffered || itemIndex > endBuffered) {
                            set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                        } else {
                            const pos = positions.get(id) ?? -1;
                            const prevPos = peek$(ctx, `containerPosition${i}`);
                            if (pos >= 0 && pos !== prevPos) {
                                set$(ctx, `containerPosition${i}`, pos);
                            }
                        }
                    }
                }

                // TODO: Add the more complex onViewableItemsChanged
                if (onViewableRangeChanged) {
                    if (
                        startNoBuffer !== startNoBufferState ||
                        startBuffered !== startBufferedState ||
                        endNoBuffer !== endNoBufferState ||
                        endBuffered !== endBufferedState
                    ) {
                        onViewableRangeChanged({
                            start: startNoBuffer!,
                            startBuffered,
                            end: endNoBuffer!,
                            endBuffered,
                            items: data.slice(startNoBuffer!, endNoBuffer! + 1),
                        });
                    }
                }
            }
        }, [data]);

        // const adjustTopPad = (diff: number) => {
        //     // TODO: Experimental, find a better way to do this.
        //     // Ideally we can do it by adjusting the contentOffset instead
        //     if (supportsEstimationAdjustment) {
        //         visibleRange$.topPad.set((v) => v - diff);
        //         const topPad = visibleRange$.topPad.peek();
        //         if (topPad > 0) {
        //             if (Platform.OS === 'ios') {
        //                 scrollRef.current?.setNativeProps({
        //                     contentInset: { top: topPad },
        //                 });
        //             } else {
        //             }
        //         }
        //     }
        // };

        useMemo(() => {
            allocateContainers();
            calculateItemsInView();

            // Set an initial total height based on what we know
            const lengths = refState.current?.lengths!;
            let totalLength = 0;
            for (let i = 0; i < data.length; i++) {
                const id = getId(i);
                totalLength += lengths.get(id) ?? getItemLength(i, data[i]);
            }
            setTotalLength(totalLength);
        }, []);

        const checkAtBottom = () => {
            const { scrollLength, scroll } = refState.current!;
            const totalLength = peek$(ctx, 'totalLength');
            // Check if at end
            const distanceFromEnd = totalLength - scroll - scrollLength;
            if (refState.current) {
                refState.current.isAtBottom = distanceFromEnd < scrollLength * maintainScrollAtEndThreshold;
            }
            if (onEndReached && !refState.current?.isEndReached) {
                if (distanceFromEnd < onEndReachedThreshold! * scrollLength) {
                    if (refState.current) {
                        refState.current.isEndReached = true;
                    }
                    onEndReached({ distanceFromEnd });
                }
            }
        };

        useMemo(() => {
            if (refState.current) {
                refState.current.isEndReached = false;
            }
            calculateItemsInView();
            checkAtBottom();
        }, [data]);

        const updateItemLength = useCallback((index: number, length: number) => {
            const data = refState.current?.data;
            if (!data) {
                return;
            }
            const lengths = refState.current?.lengths!;
            const id = getId(index);
            const wasInFirstRender = refState.current?.idsInFirstRender.has(id);

            const prevLength = lengths.get(id) || (wasInFirstRender ? getItemLength(index, data[index]) : 0);
            // let scrollNeedsAdjust = 0;

            if (!prevLength || prevLength !== length) {
                // TODO: Experimental scroll adjusting
                // const diff = length - (prevLength || 0);
                // const startNoBuffer = visibleRange$.startNoBuffer.peek();
                // if (refPositions.current?.hasScrolled && wasInFirstRender && index <= startNoBuffer) {
                //     scrollNeedsAdjust += diff;
                // }

                lengths.set(id, length);
                const totalLength = peek$(ctx, 'totalLength');
                setTotalLength(totalLength + (length - prevLength));

                if (refState.current?.isAtBottom && maintainScrollAtEnd) {
                    // TODO: This kinda works, but with a flash. Since setNativeProps is less ideal we'll favor the animated one for now.
                    // scrollRef.current?.setNativeProps({
                    //   contentContainerStyle: {
                    //     height:
                    //       visibleRange$.totalLength.get() + visibleRange$.topPad.get() + 48,
                    //   },
                    //   contentOffset: {
                    //     y:
                    //       visibleRange$.totalLength.peek() +
                    //       visibleRange$.topPad.peek() -
                    //       SCREEN_LENGTH +
                    //       48 * 3,
                    //   },
                    // });

                    // TODO: This kinda works too, but with more of a flash
                    requestAnimationFrame(() => {
                        refScroller.current?.scrollToEnd({
                            animated: true,
                        });
                    });
                }

                // TODO: Could this be optimized to only calculate items in view that have changed?

                // Calculate positions if not currently scrolling and have a calculate already pending
                if (!refState.current?.animFrame) {
                    calculateItemsInView();
                }

                // TODO: Experimental
                // if (scrollNeedsAdjust) {
                //     adjustTopPad(scrollNeedsAdjust);
                // }
            }
        }, []);

        const handleScrollDebounced = useCallback(() => {
            calculateItemsInView();
            checkAtBottom();

            // Reset the debounce
            if (refState.current) {
                refState.current.animFrame = null;
            }
        }, []);

        const onLayout = useCallback((event: LayoutChangeEvent) => {
            const scrollLength = event.nativeEvent.layout[horizontal ? 'width' : 'height'];
            refState.current!.scrollLength = scrollLength;
        }, []);

        const handleScroll = useCallback(
            (
                event: {
                    nativeEvent: NativeScrollEvent;
                },
                fromSelf?: boolean,
            ) => {
                // in some cases when we set ScrollView contentOffset prop, there comes event from with 0 height and width
                // this causes blank list display, looks to be Paper implementation problem
                // let's filter out such events
                if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
                    return;
                }
                refState.current!.hasScrolled = true;
                const newScroll = event.nativeEvent.contentOffset[horizontal ? 'x' : 'y'];
                // Update the scroll position to use in checks
                refState.current!.scroll = newScroll;

                // Debounce a calculate if no calculate is already pending
                if (refState.current && !refState.current.animFrame) {
                    refState.current.animFrame = requestAnimationFrame(handleScrollDebounced);
                }

                if (!fromSelf) {
                    onScrollProp?.(event as NativeSyntheticEvent<NativeScrollEvent>);
                }
            },
            [],
        );

        return (
            <ListComponent
                {...rest}
                contentContainerStyle={contentContainerStyle}
                style={style}
                horizontal={horizontal!}
                refScroller={refScroller}
                initialContentOffset={initialContentOffset}
                getRenderedItem={getRenderedItem}
                updateItemLength={updateItemLength}
                handleScroll={handleScroll}
                onLayout={onLayout}
                recycleItems={recycleItems}
                alignItemsAtEnd={alignItemsAtEnd}
                estimatedItemSize={estimatedItemSize}
            />
        );
    },
) as <T>(props: LegendListProps<T> & { ref?: ForwardedRef<ScrollView> }) => ReactElement;
