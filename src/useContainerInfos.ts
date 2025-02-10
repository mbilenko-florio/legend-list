import { useCallback, useRef, useState } from "react";
import type { ContainerData } from "./types";

export const useContainerInfos = () => {
    const [info, setInfo] = useState<ContainerData[]>([]);
    const stateRef = useRef<ContainerData[]>([]);
    const setContainerInfo = useCallback((id: number, data: ContainerData) => {
        setInfo((prev) => {
            const newInfo = [...prev];
            newInfo[id] = data;
            //console.log("Modifying",data.itemKey)
            stateRef.current = newInfo;
            return newInfo;
        });
    },[])
    const setContainerInfos = useCallback((data: [number, ContainerData][]) => {
        //console.log("setContainerInfos", data)
        setInfo((prev) => {
            const newInfo = [...prev];
            for (const [id, info] of data) {
                newInfo[id] = info;
                //console.log("Modifying multiple",info.itemKey)
                stateRef.current = newInfo;
            }
           
            return newInfo;
        });
    },[]);
    const peek = useCallback((i:number) => stateRef.current[i],[]);
    return { info, setContainerInfo,setContainerInfos, peek };
}