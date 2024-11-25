import { peek$, set$ } from './state';
import { OPTIMIZE_DIRECTION, POSITION_OUT_OF_VIEW } from './constants';
import type { LegendListProps, InternalState } from './types';
import {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    unstable_batchedUpdates,
} from 'react-native';

export function applyDefaultProps(props: LegendListProps<any>) {
    return {
        ...props,
        recycleItems: props.recycleItems || false,
        onEndReachedThreshold: props.onEndReachedThreshold || 0.5,
        maintainScrollAtEndThreshold: props.maintainScrollAtEndThreshold || 0.1,
        maintainScrollAtEnd: props.maintainScrollAtEnd || false,
        alignItemsAtEnd: props.alignItemsAtEnd || false,
    };
}

export function allocateContainers(state: InternalState) {
    const { scrollLength, props, ctx, scrollBuffer } = state;
    const averageItemSize = props.estimatedItemSize ?? props.getEstimatedItemSize?.(0, props.data[0]);
    const numContainers =
        props.initialNumContainers || Math.ceil((scrollLength + scrollBuffer * 2) / averageItemSize) + 4;

    for (let i = 0; i < numContainers; i++) {
        set$(ctx, `containerIndex${i}`, -1);
        set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
    }

    set$(ctx, `numContainers`, numContainers);
}

export function getId(state: InternalState, index: number) {
    const { data, keyExtractor } = state.props;
    if (!data) {
        return '';
    }
    const ret = index < data.length ? (keyExtractor ? keyExtractor(data[index], index) : index) : null;
    return ret + '';
}

export function calculateInitialOffset(props: LegendListProps<any>) {
    const { data, initialScrollIndex, estimatedItemSize, getEstimatedItemSize } = props;
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
}

export function setTotalLength(state: InternalState, totalLength: number) {
    const { ctx, props } = state;
    set$(ctx, `totalLength`, totalLength);
    const screenLength = state.scrollLength;
    if (props.alignItemsAtEnd) {
        const listPaddingTop =
            ((props.style as any)?.paddingTop || 0) + ((props.contentContainerStyle as any)?.paddingTop || 0);
        set$(ctx, `paddingTop`, Math.max(0, screenLength - length - listPaddingTop));
    }
}

export function getRenderedItem(state: InternalState, index: number) {
    const { data, renderItem } = state.props;
    if (!data) {
        return null;
    }
    const renderedItem = renderItem?.({
        item: data[index],
        index,
    } as any);

    return renderedItem;
}

export const getItemSize = (state: InternalState, index: number, data: any[]) => {
    const { getEstimatedItemSize, estimatedItemSize } = state.props;
    return getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize;
};

export function calculateItemsInView(state: InternalState) {
    // This should be a good optimization to make sure that all React updates happen in one frame
    // but it should be tested more with and without it to see if it's better.
    unstable_batchedUpdates(() => {
        const {
            props: { data, onViewableRangeChanged },
            scrollLength,
            scroll: scrollState,
            topPad,
            startNoBuffer: startNoBufferState,
            startBuffered: startBufferedState,
            endNoBuffer: endNoBufferState,
            endBuffered: endBufferedState,
            lengths,
            positions,
            scrollBuffer,
            ctx,
        } = state;

        if (!data) {
            return;
        }
        const scroll = scrollState - topPad;
        const direction = scroll > state.scrollPrevious ? 1 : -1;
        const optimizeDirection = OPTIMIZE_DIRECTION;
        const scrollBufferTop = optimizeDirection
            ? direction > 0
                ? scrollBuffer * 0.25
                : scrollBuffer * 1.75
            : scrollBuffer;
        const scrollBufferBottom = optimizeDirection
            ? direction > 0
                ? scrollBuffer * 1.75
                : scrollBuffer * 0.25
            : scrollBuffer;

        let startNoBuffer: number | null = null;
        let startBuffered: number | null = null;
        let endNoBuffer: number | null = null;
        let endBuffered: number | null = null;

        // Go backwards from the last start position to find the first item that is in view
        // This is an optimization to avoid looping through all items, which could slow down
        // when scrolling at the end of a long list.
        let loopStart = startBufferedState || 0;
        if (startBufferedState) {
            for (let i = startBufferedState; i >= 0; i--) {
                const id = getId(state, i)!;
                const top = positions.get(id)!;
                if (top !== undefined) {
                    const length = lengths.get(id) ?? getItemSize(state, i, data[i]);
                    const bottom = top + length;
                    if (bottom > scroll - scrollBufferTop) {
                        loopStart = i;
                    } else {
                        break;
                    }
                }
            }
        }

        let top = loopStart > 0 ? positions.get(getId(state, loopStart))! : 0;

        for (let i = loopStart; i < data!.length; i++) {
            const id = getId(state, i)!;
            const length = lengths.get(id) ?? getItemSize(state, i, data[i]);

            if (positions.get(id) !== top) {
                positions.set(id, top);
            }

            if (startNoBuffer === null && top + length > scroll) {
                startNoBuffer = i;
            }
            if (startBuffered === null && top + length > scroll - scrollBufferTop) {
                startBuffered = i;
            }
            if (startNoBuffer !== null) {
                if (top <= scroll + scrollLength) {
                    endNoBuffer = i;
                }
                if (top <= scroll + scrollLength + scrollBufferBottom) {
                    endBuffered = i;
                } else {
                    break;
                }
            }

            top += length;
        }

        Object.assign(state, {
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
                    const id = getId(state, itemIndex);
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
    });
}

export function updateItemSize(
    state: InternalState,
    refScroller: React.RefObject<ScrollView>,
    index: number,
    length: number,
) {
    const {
        props: { data, maintainScrollAtEnd },
        ctx,
        lengths,
        idsInFirstRender,
        isAtBottom,
    } = state;
    if (!data) {
        return;
    }
    const id = getId(state, index);
    const wasInFirstRender = idsInFirstRender.has(id);

    const prevLength = lengths.get(id) || (wasInFirstRender ? getItemSize(state, index, data[index]) : 0);
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
        setTotalLength(state, totalLength + (length - prevLength));

        if (isAtBottom && maintainScrollAtEnd) {
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
        if (!state.animFrameScroll) {
            calculateItemsInView(state);
        }

        // TODO: Experimental
        // if (scrollNeedsAdjust) {
        //     adjustTopPad(scrollNeedsAdjust);
        // }
    }
}

export function checkAtBottom(state: InternalState) {
    const {
        ctx,
        scrollLength,
        scroll,
        props: { maintainScrollAtEndThreshold, onEndReached, onEndReachedThreshold },
    } = state!;
    const totalLength = peek$(ctx, 'totalLength');
    // Check if at end
    const distanceFromEnd = totalLength - scroll - scrollLength;
    state.isAtBottom = distanceFromEnd < scrollLength * maintainScrollAtEndThreshold!;
    if (onEndReached && !state.isEndReached) {
        if (distanceFromEnd < onEndReachedThreshold! * scrollLength) {
            state.isEndReached = true;
            onEndReached({ distanceFromEnd });
        }
    }
}

export function handleScrollDebounced(state: InternalState) {
    calculateItemsInView(state);
    checkAtBottom(state);

    // Reset the debounce
    state.animFrameScroll = null;
}

export function handleScroll(
    state: InternalState,
    onScrollDebounced: () => void,
    event: {
        nativeEvent: NativeScrollEvent;
    },
) {
    // in some cases when we set ScrollView contentOffset prop, there comes event from with 0 height and width
    // this causes blank list display, looks to be Paper implementation problem
    // let's filter out such events
    if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
        return;
    }
    const { horizontal, onScroll } = state.props;
    state.hasScrolled = true;
    const newScroll = event.nativeEvent.contentOffset[horizontal ? 'x' : 'y'];
    // Update the scroll position to use in checks
    state.scrollPrevious = state.scroll;
    state.scroll = newScroll;

    // Debounce a calculate if no calculate is already pending
    if (state && !state.animFrameScroll) {
        state.animFrameScroll = requestAnimationFrame(onScrollDebounced);
    }

    onScroll?.(event as NativeSyntheticEvent<NativeScrollEvent>);
}

export function onLayout(state: InternalState, event: LayoutChangeEvent) {
    const scrollLength = event.nativeEvent.layout[state.props.horizontal ? 'width' : 'height'];
    state.scrollLength = scrollLength;
}
