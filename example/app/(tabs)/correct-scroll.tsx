import { LegendList } from '@legendapp/list';
import { useRef, useState } from 'react';
import { LogBox, Platform, ScrollView, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Item, renderItem } from '../renderItem';
import Breathe from '@/components/Breathe';

LogBox.ignoreLogs(['Open debugger']);

// @ts-ignore
const uiManager = global?.nativeFabricUIManager ? 'Fabric' : 'Paper';

console.log(`Using ${uiManager}`);

const ESTIMATED_ITEM_LENGTH = 200;

type RenderItem = Item & { type: 'separator' | 'item' };

const RenderMultiItem = ({ item, index }: { item: RenderItem; index: number }) => {
    if (item.type === 'separator') {
        return (
            <View style={{ height: 52, backgroundColor: 'red', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: 'white' }}>Separator {item.id}</Text>
            </View>
        );
    }
    return renderItem({ item, index });
};

export default function HomeScreen() {
    const scrollViewRef = useRef<ScrollView>(null);

    const [data, setData] = useState<RenderItem[]>(
        () =>
            Array.from({ length: 500 }, (_, i) => ({
                id: i.toString(),
                type: i % 3 === 0 ? 'separator' : 'item',
            })) as any[],
    );

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                ref={scrollViewRef}
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                contentContainerStyle={styles.listContainer}
                data={data}
                renderItem={RenderMultiItem}
                keyExtractor={(item) => item.id}
                estimatedItemLength={(i, item) => (item.type === 'separator' ? 52 : 400)}
                estimatedAverateItemLength={200}
                drawDistance={1000}
                recycleItems={true}
                // alignItemsAtEnd
                // maintainScrollAtEnd
                onEndReached={({ distanceFromEnd }) => {
                    console.log('onEndReached', distanceFromEnd);
                }}
                //ListHeaderComponent={<View />}
                //ListHeaderComponentStyle={styles.listHeader}
                // initialScrollOffset={20000}
                initialScrollIndex={50}
                // inverted
                // horizontal
            />
        </View>
    );
}

const styles = StyleSheet.create({
    listHeader: {
        alignSelf: 'center',
        height: 100,
        width: 100,
        backgroundColor: '#456AAA',
        borderRadius: 12,
        marginHorizontal: 8,
        marginTop: 8,
    },
    outerContainer: {
        backgroundColor: '#456',
        bottom: Platform.OS === 'ios' ? 82 : 0,
    },
    scrollContainer: {
        paddingHorizontal: 16,
        // paddingrVertical: 48,
    },

    itemContainer: {
        height: 405,
        // padding: 4,
        // borderBottomWidth: 1,
        // borderBottomColor: "#ccc",
    },
    listContainer: {
        // paddingHorizontal: 16,
        paddingTop: 48,
    },
});
