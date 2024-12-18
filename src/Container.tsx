import React from "react";
import type { DimensionValue, LayoutChangeEvent, ViewStyle } from "react-native";
import { $View } from "./$View";
import { peek$, set$, use$, useStateContext } from "./state";

interface InnerContainerProps {
    containerId: number;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
}
function InnerContainer({ containerId, getRenderedItem, recycleItems, ItemSeparatorComponent }: InnerContainerProps) {
    // Subscribe to the lastItemKey so this re-renders when the lastItemKey changes.
    const lastItemKey = use$<string>("lastItemKey");
    const itemKey = use$<string>(`containerItemKey${containerId}`);

    if (itemKey === undefined) {
        return null;
    }

    const renderedItem = getRenderedItem(itemKey, containerId);

    return (
        <React.Fragment key={recycleItems ? undefined : itemKey}>
            {renderedItem}
            {ItemSeparatorComponent && itemKey !== lastItemKey && ItemSeparatorComponent}
        </React.Fragment>
    );
}

export const Container = ({
    id,
    recycleItems,
    horizontal,
    getRenderedItem,
    onLayout,
    ItemSeparatorComponent,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
    onLayout: (key: string, size: number) => void;
    ItemSeparatorComponent?: React.ReactNode;
}) => {
    const ctx = useStateContext();

    const createStyle = (): ViewStyle => {
        const position = peek$<number>(ctx, `containerPosition${id}`);
        const column = peek$<number>(ctx, `containerColumn${id}`) || 0;
        const visible = peek$<boolean>(ctx, `containerDidLayout${id}`);
        const numColumns = peek$<number>(ctx, "numColumns");

        const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
        const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;

        return horizontal
            ? {
                  flexDirection: "row",
                  position: "absolute",
                  top: visible ? otherAxisPos : -10000000,
                  bottom: numColumns > 1 ? null : 0,
                  height: otherAxisSize,
                  left: position,
              }
            : {
                  position: "absolute",
                  left: visible ? otherAxisPos : -10000000,
                  right: numColumns > 1 ? null : 0,
                  width: otherAxisSize,
                  top: position,
              };
    };

    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <$View
            $key={`containerPosition${id}`}
            $key2={`containerDidLayout${id}`}
            $key3={`containerColumn${id}`}
            $key4="numColumns"
            $style={createStyle}
            onLayout={(event: LayoutChangeEvent) => {
                const key = peek$<string>(ctx, `containerItemKey${id}`);
                if (key !== undefined) {
                    const size = event.nativeEvent.layout[horizontal ? "width" : "height"];

                    // console.log("layout", key, size);
                    onLayout(key, size);

                    const measured = peek$(ctx, `containerDidLayout${id}`);
                    if (!measured) {
                        requestAnimationFrame(() => {
                            set$(ctx, `containerDidLayout${id}`, true);
                        });
                    }
                }
            }}
        >
            <InnerContainer
                containerId={id}
                getRenderedItem={getRenderedItem}
                recycleItems={recycleItems!}
                ItemSeparatorComponent={ItemSeparatorComponent}
            />
        </$View>
    );
};
