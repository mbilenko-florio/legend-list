import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { DimensionValue, LayoutChangeEvent, StyleProp, View, ViewStyle } from "react-native";
import { ContextContainer } from "./ContextContainer";
import { LeanView } from "./LeanView";
import { ANCHORED_POSITION_OUT_OF_VIEW } from "./constants";
import { peek$, use$, useStateContext } from "./state";
import type { AnchoredPosition } from "./types";

// @ts-expect-error nativeFabricUIManager is not defined in the global object types
const isNewArchitecture = global.nativeFabricUIManager != null;

export const Container = ({
    id,
    recycleItems,
    horizontal,
    getRenderedItem,
    updateItemSize,
    ItemSeparatorComponent,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    getRenderedItem: (key: string) => { index: number; renderedItem: React.ReactNode } | null;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    ItemSeparatorComponent?: React.ReactNode;
}) => {
    const ctx = useStateContext();
    const maintainVisibleContentPosition = use$<boolean>("maintainVisibleContentPosition");
    const position = use$<AnchoredPosition>(`containerPosition${id}`) || ANCHORED_POSITION_OUT_OF_VIEW;
    const column = use$<number>(`containerColumn${id}`) || 0;
    const numColumns = use$<number>("numColumns");

    const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;

    const style: StyleProp<ViewStyle> = horizontal
        ? {
              flexDirection: ItemSeparatorComponent ? "row" : undefined,
              position: "absolute",
              top: otherAxisPos,
              bottom: numColumns > 1 ? null : 0,
              height: otherAxisSize,
              left: position.relativeCoordinate,
          }
        : {
              position: "absolute",
              left: otherAxisPos,
              right: numColumns > 1 ? null : 0,
              width: otherAxisSize,
              top: position.relativeCoordinate,
          };

    const lastItemKey = use$<string>("lastItemKey");
    const itemKey = use$<string>(`containerItemKey${id}`);
    const data = use$<any>(`containerItemData${id}`); // to detect data changes
    const extraData = use$<string>("extraData"); // to detect extraData changes
    const refLastSize = useRef<number>();

    const renderedItemInfo = useMemo(
        () => itemKey !== undefined && getRenderedItem(itemKey),
        [itemKey, data, extraData],
    );
    const { index, renderedItem } = renderedItemInfo || {};

    const didLayout = false;

    useEffect(() => {
        // Catch a rare bug where a container is reused and is the exact same size as the previous item
        // so it does not fire an onLayout, so we need to trigger it manually.
        // TODO: There must be a better way to do this?
        if (itemKey) {
            const timeout = setTimeout(() => {
                if (!didLayout && refLastSize.current) {
                    updateItemSize(id, itemKey, refLastSize.current);
                }
            }, 16);
            return () => {
                clearTimeout(timeout);
            };
        }
    }, [itemKey]);

    const onLayout = (event: LayoutChangeEvent) => {
        const key = peek$<string>(ctx, `containerItemKey${id}`);
        if (key !== undefined) {
            // Round to nearest quater pixel to avoid accumulating rounding errors
            const size = Math.floor(event.nativeEvent.layout[horizontal ? "width" : "height"] * 8) / 8;
            //updateItemSize(id, key, size);
            // console.log("onLayout", itemKey, size, performance.now());

            // const otherAxisSize = horizontal ? event.nativeEvent.layout.width : event.nativeEvent.layout.height;
            // set$(ctx, "otherAxisSize", Math.max(otherAxisSize, peek$(ctx, "otherAxisSize") || 0));
        }
    };

    const ref = useRef<View>(null);
    if (isNewArchitecture) {
        useLayoutEffect(() => {
            if (itemKey) {
                const measured = ref.current?.unstable_getBoundingClientRect?.();
            if (measured) {
                const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                if (size) {
                    //console.log("useLayoutEffect",itemKey,size, performance.now());
                    updateItemSize(id, itemKey, size);
                }
            }
            }
        }, [itemKey]);
    }

    const contextValue = useMemo(
        () => ({ containerId: id, itemKey, index: index!, value: data }),
        [id, itemKey, index, data],
    );

    const contentFragment = (
        <React.Fragment key={recycleItems ? undefined : itemKey}>
            <ContextContainer.Provider value={contextValue}>
                {renderedItem}
                {renderedItem && ItemSeparatorComponent && itemKey !== lastItemKey && ItemSeparatorComponent}
            </ContextContainer.Provider>
        </React.Fragment>
    );

    // If maintainVisibleContentPosition is enabled, we need a way items to grow upwards
    if (maintainVisibleContentPosition) {
        const anchorStyle: StyleProp<ViewStyle> =
            position.type === "top"
                ? { position: "absolute", top: 0, left: 0, right: 0 }
                : { position: "absolute", bottom: 0, left: 0, right: 0 };
        return (
            <LeanView style={style}>
                <LeanView style={anchorStyle} onLayout={onLayout} ref={ref}>
                    {contentFragment}
                </LeanView>
            </LeanView>
        );
    }
    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <LeanView style={style} onLayout={onLayout} ref={ref}>
            {contentFragment}
        </LeanView>
    );
};
