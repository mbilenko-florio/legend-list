import * as React from 'react';
import { ForwardedRef, forwardRef, ReactElement, useMemo, useRef } from 'react';
import { Dimensions, ScrollView, StyleSheet } from 'react-native';
import { DEFAULT_SCROLL_BUFFER } from './constants';
import {
    allocateContainers,
    applyDefaultProps,
    calculateInitialOffset as calculateInitialOffsetHelper,
    calculateItemsInView as calculateItemsInViewHelper,
    checkAtBottom as checkAtBottomHelper,
    getId as getIdHelper,
    getItemSize as getItemSizeHelper,
    getRenderedItem as getRenderedItemHelper,
    handleScrollDebounced as handleScrollDebouncedHelper,
    handleScroll as handleScrollHelper,
    onLayout as onLayoutHelper,
    addTotalLength as addTotalLengthHelper,
    updateItemSize as updateItemSizeHelper,
} from './LegendListHelpers';
import { ListComponent } from './ListComponent';
import { peek$, set$, StateProvider, useStateContext } from './state';
import type { InternalState, LegendListProps, LegendListRef } from './types';

export const LegendList: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement =
    forwardRef(function LegendList<T>(props: LegendListProps<T>, forwardedRef: ForwardedRef<LegendListRef>) {
        return (
            <StateProvider>
                <LegendListInner {...props} ref={forwardedRef} />
            </StateProvider>
        );
    }) as any;

const LegendListInner: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement =
    forwardRef(function LegendListInner<T>(props_: LegendListProps<T>, forwardedRef: ForwardedRef<LegendListRef>) {
        const props = applyDefaultProps(props_);
        const {
            data,
            initialScrollIndex,
            initialScrollOffset,
            horizontal,
            style: styleProp,
            contentContainerStyle: contentContainerStyleProp,
            drawDistance,
            ...rest
        } = props;

        const ctx = useStateContext();

        const refScroller = useRef<ScrollView>(null) as React.MutableRefObject<ScrollView>;
        const scrollBuffer = drawDistance ?? DEFAULT_SCROLL_BUFFER;
        // Experimental: It works ok on iOS when scrolling up, but is doing weird things when sizes are changing.
        // And it doesn't work at all on Android because it uses contentInset. I'll try it again later.
        // Ideally it would work by adjusting the contentOffset but in previous attempts that was causing jitter.
        const supportsEstimationAdjustment = false; //   Platform.OS === "ios";

        const refState = useRef<InternalState<T>>();

        const initialContentOffset =
            initialScrollOffset ?? useMemo(calculateInitialOffsetHelper.bind(undefined, props), []);

        if (!refState.current) {
            refState.current = {
                lengths: new Map(),
                positions: new Map(),
                pendingAdjust: 0,
                animFrameScroll: null,
                animFrameLayout: null,
                isStartReached: false,
                isEndReached: false,
                isAtBottom: false,
                idsInFirstRender: undefined as any,
                hasScrolled: false,
                scrollLength: Dimensions.get('window')[horizontal ? 'width' : 'height'],
                startBuffered: 0,
                startNoBuffer: 0,
                endBuffered: 0,
                endNoBuffer: 0,
                scroll: initialContentOffset || 0,
                scrollPrevious: initialContentOffset || 0,
                previousViewableItems: new Set(),
                props,
                ctx,
                scrollBuffer,
            };
            refState.current.idsInFirstRender = new Set(
                data.map((_: any, i: number) => getIdHelper(refState.current!, i)),
            );
        }
        refState.current.props = props;
        refState.current.ctx = ctx;

        const styleFlattened = StyleSheet.flatten(styleProp);
        const style = useMemo(() => styleFlattened, [JSON.stringify(styleProp)]);
        const contentContainerStyleFlattened = StyleSheet.flatten(contentContainerStyleProp);
        const contentContainerStyle = useMemo(
            () => contentContainerStyleFlattened,
            [JSON.stringify(contentContainerStyleProp)],
        );

        // Create functions that are bound to the state to avoid re-creating them on every render.
        // This should be a minor optimization when data is changing often. And putting them elsewhere
        // makes sure we always get the latest values from state and avoid accidentally using stale values.
        const fns = useMemo(
            () => ({
                getRenderedItem: getRenderedItemHelper.bind(undefined, refState.current!),
                getId: getIdHelper.bind(undefined, refState.current!),
                getItemSize: getItemSizeHelper.bind(undefined, refState.current!),
                calculateItemsInView: calculateItemsInViewHelper.bind(undefined, refState.current!),
                updateItemSize: updateItemSizeHelper.bind(undefined, refState.current!, refScroller),
                checkAtBottom: checkAtBottomHelper.bind(undefined, refState.current!),
                handleScrollDebounced: handleScrollDebouncedHelper.bind(undefined, refState.current!),
                onLayout: onLayoutHelper.bind(undefined, refState.current!),
                addTotalLength: addTotalLengthHelper.bind(undefined, refState.current!),
                handleScroll: handleScrollHelper.bind(
                    undefined,
                    refState.current!,
                    handleScrollDebouncedHelper.bind(undefined, refState.current!),
                ),
            }),
            [],
        );
        const {
            calculateItemsInView,
            getId,
            getItemSize,
            checkAtBottom,
            updateItemSize,
            getRenderedItem,
            onLayout,
            handleScroll,
            addTotalLength,
        } = fns;

        set$(ctx, `numItems`, data.length);
        // TODO: This needs to support horizontal and other ways of defining padding.
        set$(ctx, `stylePaddingTop`, styleFlattened?.paddingTop ?? contentContainerStyleFlattened?.paddingTop ?? 0);

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
            allocateContainers(refState.current!);
            calculateItemsInView();

            // Set an initial total height based on what we know
            const lengths = refState.current?.lengths!;
            let totalLength = (peek$(ctx, `headerSize`) || 0) + (peek$(ctx, `footerSize`) || 0);
            for (let i = 0; i < data.length; i++) {
                const id = getId(i);
                totalLength += lengths.get(id) ?? getItemSize(i, data[i]);
            }
            addTotalLength(totalLength);
        }, []);

        useMemo(() => {
            if (refState.current) {
                refState.current.isEndReached = false;
            }
            calculateItemsInView();
            checkAtBottom();
        }, [data]);

        React.useImperativeHandle(forwardedRef, () => {
            const scrollToIndex = ({ index, animated }: Parameters<LegendListRef['scrollToIndex']>[0]) => {
                // naive implementation to search element by index
                // create some accurate search algorithm
                // FlashList seems to be able to find index in the dynamic size list with some search
                const offsetObj = calculateInitialOffsetHelper.call(undefined, {
                    ...props,
                    initialScrollIndex: index,
                });
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
        }, []);

        return (
            <ListComponent
                {...rest}
                addTotalLength={addTotalLength}
                contentContainerStyle={contentContainerStyle}
                style={style}
                horizontal={horizontal!}
                refScroller={refScroller}
                initialContentOffset={initialContentOffset}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                handleScroll={handleScroll}
                onLayout={onLayout}
            />
        );
    }) as <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement;
