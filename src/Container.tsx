import React, { useEffect, useMemo, useRef } from "react";
import type { DimensionValue, LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { LeanView } from "./LeanView";
import { ANCHORED_POSITION_OUT_OF_VIEW } from "./constants";
import { peek$, use$, useStateContext } from "./state";
import type { ContainerData } from "./types";

export const Container = ({
    id,
    recycleItems,
    horizontal,
    waitForInitialLayout,
    getRenderedItem,
    updateItemSize,
    ItemSeparatorComponent,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    waitForInitialLayout: boolean | undefined;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    ItemSeparatorComponent?: React.ReactNode;
}) => {
    const ctx = useStateContext();
    const numColumns = use$<number>("numColumns");
    const maintainVisibleContentPosition = use$<boolean>("maintainVisibleContentPosition");
    let info = use$<ContainerData>(`containerInfo${id}`);
    if (!info) {
        info = {
            position: ANCHORED_POSITION_OUT_OF_VIEW,
            column: 1,
            didLayout: false,
            itemKey: undefined,
            data: undefined,

        }
    }
    console.log("Render", info.itemKey)
   const {column, position, didLayout: visible, itemKey, data} = info;


    const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;

    const style: StyleProp<ViewStyle> = horizontal
        ? {
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

    if (waitForInitialLayout) {
        style.opacity = visible ? 1 : 0;
    }

    const lastItemKey = use$<string>("lastItemKey");
    const extraData = use$<string>("extraData"); // to detect extraData changes
    const refLastSize = useRef<number>();

    const renderedItem = useMemo(
        () => itemKey !== undefined && getRenderedItem(itemKey, id),
        [itemKey, data, extraData],
    );
    const didLayout = false;

    useEffect(() => {
        // Catch a rare bug where a container is reused and is the exact same size as the previous item
        // so it does not fire an onLayout, so we need to trigger it manually.
        // TODO: There must be a better way to do this?
        if (itemKey) {
            const timeout = setTimeout(() => {
                if (!didLayout && refLastSize.current) {
                    updateItemSize(id, itemKey, refLastSize.current);
                    console.log("Force update!", itemKey)
                }
            }, 16);
            return () => {
                clearTimeout(timeout);
            };
        }
    }, [itemKey]);

    const onLayout = (event: LayoutChangeEvent) => {
        const container = peek$<ContainerData>(ctx, `containerInfo${id}`) || {};
        if (container.itemKey !== undefined) {
            // Round to nearest quater pixel to avoid accumulating rounding errors
            const size = Math.floor(event.nativeEvent.layout[horizontal ? "width" : "height"] * 8) / 8;
            updateItemSize(id, container.itemKey, size);

            // const otherAxisSize = horizontal ? event.nativeEvent.layout.width : event.nativeEvent.layout.height;
            // set$(ctx, "otherAxisSize", Math.max(otherAxisSize, peek$(ctx, "otherAxisSize") || 0));
        }
    };

    const contentFragment = (
        <React.Fragment key={recycleItems ? undefined : itemKey}>
            {renderedItem}
            {renderedItem && ItemSeparatorComponent && itemKey !== lastItemKey && ItemSeparatorComponent}
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
                <LeanView style={anchorStyle} onLayout={onLayout}>
                    {contentFragment}
                </LeanView>
            </LeanView>
        );
    }
    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <LeanView style={style} onLayout={onLayout}>
            {contentFragment}
        </LeanView>
    );
};
