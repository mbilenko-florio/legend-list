import React, { useEffect, useMemo, useRef } from "react";
import { type DimensionValue, type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from "react-native";
import { peek$, use$, useStateContext } from "./state";

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
    const position = use$<number>(`containerPosition${id}`);
    const column = use$<number>(`containerColumn${id}`) || 0;
    const numColumns = use$<number>("numColumns");

    const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;
    const style: StyleProp<ViewStyle> = horizontal
        ? {
              flexDirection: "row",
              position: "absolute",
              top: otherAxisPos,
              bottom: numColumns > 1 ? null : 0,
              height: otherAxisSize,
              left: position,
          }
        : {
              position: "absolute",
              left: otherAxisPos,
              right: numColumns > 1 ? null : 0,
              width: otherAxisSize,
              top: position,
          };

    if (waitForInitialLayout) {
        const visible = use$<boolean>(`containerDidLayout${id}`);
        style.opacity = visible ? 1 : 0;
    }

    const lastItemKey = use$<string>("lastItemKey");
    const itemKey = use$<string>(`containerItemKey${id}`);
    const data = use$<string>(`containerItemData${id}`); // to detect data changes
    const extraData = use$<string>("extraData"); // to detect extraData changes
    const refLastSize = useRef<number>();

    const renderedItem = useMemo(
        () => itemKey !== undefined && getRenderedItem(itemKey, id),
        [itemKey, data, extraData],
    );
    let didLayout = false;

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

    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <View
            style={style}
            onLayout={(event: LayoutChangeEvent) => {
                const key = peek$<string>(ctx, `containerItemKey${id}`);
                if (key !== undefined) {
                    didLayout = true;

                    // Round to nearest quater pixel to avoid accumulating rounding errors
                    const size = Math.floor(event.nativeEvent.layout[horizontal ? "width" : "height"] * 8) / 8;

                    refLastSize.current = size;
                    updateItemSize(id, key, size);

                    // const otherAxisSize = horizontal ? event.nativeEvent.layout.width : event.nativeEvent.layout.height;
                    // set$(ctx, "otherAxisSize", Math.max(otherAxisSize, peek$(ctx, "otherAxisSize") || 0));
                }
            }}
        >
            <React.Fragment key={recycleItems ? undefined : itemKey}>
                {renderedItem}
                {renderedItem && ItemSeparatorComponent && itemKey !== lastItemKey && ItemSeparatorComponent}
            </React.Fragment>
        </View>
    );
};
