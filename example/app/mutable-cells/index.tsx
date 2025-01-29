import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";
import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { Button, FlatList, Text, View } from "react-native";

const fakeData = Array.from({ length: 100 }, (_, index) => ({
    id: index,
    title: `Item ${index + 1}`,
    score: 0,
}));

type Item = typeof fakeData[number];

const DataContext = createContext({
    data: fakeData,
    increment: (id: number) => {},
});

export const DataProvider = ({
    initialData,
    children,
}: { initialData: Item[]; children: React.ReactNode }) => {
    const [data, setData] = useState(initialData);

    const increment = useCallback((id: number) => {
        setData((prevData) => {
            return prevData.map((item) => {
                if (item.id === id) {
                    return { ...item, score: item.score + 1 };
                }
                return item;
            });
        });
    }, []);

    return <DataContext.Provider value={{ data, increment }}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);

const Item = ({ item }: { item: Item}) => {
    const {increment} = useData();
    return (
        <View
            style={{
                height: 100,
                backgroundColor: "#fefefe",
                justifyContent: "center",
                paddingHorizontal: 24,
                borderRadius: 16,
            }}
        >
            <Text style={{ fontSize: 24, fontWeight: "bold" }}>{`${item.title} - Score:${item.score}`}</Text>
            <Button title="Increment" onPress={() => {
                increment(item.id);
            }} />
        </View>
    );
};

const ItemSeparatorComponent = () => <View style={{ height: 16 }} />;
const renderItem = ({
    item,
}: LegendListRenderItemProps<Item>) => <Item item={item} />;

const ItemSkeleton = () => {
    return <Item item={{id: 0, title: '---',score: 0}} />
}

export const List = () => {
    const { data } = useData();
    return (
        <View style={{ flex: 1, paddingHorizontal: 16}}>
            <FlatList
                data={data}
                estimatedItemSize={116}
                ItemSeparatorComponent={ItemSeparatorComponent}
                renderItem={renderItem}
                keyExtractor={(item) => String(item.id)}
                //SkeletonComponent={ItemSkeleton}
                //useFlashListContainers
            />
        </View>
    );
};

export default function HomeScreen() {
    return (
        <DataProvider initialData={fakeData}>
            <List />
        </DataProvider>
    );
}
