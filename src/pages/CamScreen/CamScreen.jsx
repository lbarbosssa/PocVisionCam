import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, Button, View, Image } from "react-native";
import {
    BorderTypes,
    ColorConversionCodes,
    ColormapTypes,
    ContourApproximationModes,
    DataTypes,
    LineTypes,
    ObjectType,
    OpenCV,
    RetrievalModes,
    ThresholdTypes
} from "react-native-fast-opencv";
import ImageEditor from '@react-native-community/image-editor';

import {
    useCameraDevice,
    useCameraPermission,
    // useFrameProcessor,
    // useCodeScanner,
    Camera,
} from "react-native-vision-camera";
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';



const CamScreen = () => {
    const [photoUri, setPhotoUri] = useState(null);
    const [processedPhoto, setProcessedPhoto] = useState(null);
    const [thresholdValue, setThresholdValue] = useState(160);

    const [croppedImage, setCroppedImage] = useState(null);
    const [showCam, setShowCam] = useState(true);
    const cameraRef = useRef(null);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);
    const [error, setError] = useState(null);

    const onCameraInitialized = () => {
        setIsCameraInitialized(true);
    };


    const takePhoto = async () => {
        console.log('ué')
        if (photoUri) {
            setPhotoUri(null);
            setProcessedPhoto(null)
            setShowCam(true)
        } else if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePhoto({
                    flash: 'off',
                    qualityPrioritization: 'balanced',
                });
                setShowCam(false)
                setPhotoUri(photo.path); // Salva a URI da imagem capturada
                console.log(photo.path);
                // await processImage()


            } catch (error) {
                console.error("Erro ao capturar foto: ", error);
            }
        }
    };

    useEffect(() => {
        if (photoUri) {
            processImage();  // Chama o processImage apenas quando o photoUri for atualizado
        }
    }, [photoUri, thresholdValue]);

    const processImage = async () => {
        try {
            const resizedImage = await ImageResizer.createResizedImage(
                photoUri,
                1200,
                1200,
                'PNG',
                100
            );

            const imagePath = resizedImage.path;
            const fileData = await RNFS.readFile(imagePath, 'base64');

            const src = OpenCV.base64ToMat(fileData);
            const dst = OpenCV.createObject(ObjectType.Mat, 1200, 1200, DataTypes.CV_8U);
            const gray = OpenCV.createObject(ObjectType.Mat, 1200, 1200, DataTypes.CV_8U);

            OpenCV.invoke('cvtColor', src, gray, ColorConversionCodes.COLOR_BGR2GRAY);
            ; // Valor de threshold, ajustável conforme necessário
            OpenCV.invoke(
                'threshold',
                gray,
                dst,
                thresholdValue,
                200,
                ThresholdTypes.THRESH_BINARY
            );


            // Detectar contornos
            const contours = OpenCV.createObject(ObjectType.MatVector);
            OpenCV.invoke(
                'findContours',
                dst,
                contours,
                RetrievalModes.RETR_TREE,
                ContourApproximationModes.CHAIN_APPROX_SIMPLE
            );
            const contoursMats = OpenCV.toJSValue(contours);
            // const rectangles: Rect[] = [];
            const rectangles = [];
            for (let i = 0; i < contoursMats.array.length; i++) {
                const contour = OpenCV.copyObjectFromVector(contours, i);
                const { value: area } = OpenCV.invoke('contourArea', contour, false);

                if (area > 3000) {
                    const rect = OpenCV.invoke('boundingRect', contour);
                    rectangles.push(OpenCV.toJSValue(rect));
                }
            }

            const rectangle = rectangles[0]; // Considera apenas o primeiro retângulo encontrado
            if (rectangle) {
                const { x, y, width, height } = rectangle;
                console.log({
                    height,
                    width,
                    x,
                    y
                });
            }

            const dstResult = OpenCV.toJSValue(dst);
            OpenCV.clearBuffers();
            console.log('Imagem processada com sucesso');
            await cropImage(`data:image/jpeg;base64,${dstResult.base64}`, rectangle);
            // console.log(dstResult.base64);


        } catch (error) {
            setError(`Erro ao processar a imagem: ${error}`);
            console.error('Erro ao processar a imagem:', error);
        }
    };

    const cropImage = async (base64Img, coords) => {
        // console.log(base64Img)
        try {
            // Defina as coordenadas de corte
            const marginWidth = 0; // Adicionar 20px de margem na largura
            const marginHeight = 0; // Adicionar 30px de margem na altura
            const cropData = {
                offset: {
                    x: Math.max(0, coords.x - marginWidth),
                    y: Math.max(0, coords.y - marginHeight),
                },
                size: {
                    width: coords.width + marginWidth * 2, // Adiciona a margem dos dois lados
                    height: coords.height + marginHeight * 2, // Adiciona a margem superior e inferior
                },
                format: 'png'
            };

            // Realize o crop
            const uri = await ImageEditor.cropImage(base64Img, cropData);

            // const b64 = await RNFS.readFile(uri, 'base64');
            console.log(uri.uri)
            setProcessedPhoto(uri.uri);
        } catch (error) {
            console.error('Erro ao cortar a imagem:', error);
        }
    };


    if (!hasPermission) return <Text onPress={() => requestPermission()}>Sem Permissão</Text>;

    if (device == null) return <Text>Sem Câmera</Text>;


    // const frameProcessor = useFrameProcessor(async (frame) => {
    //     'worklet';
    //     console.log('frame')
    // }, []);


    // const codeScanner = useCodeScanner({
    //     codeTypes: ['code-128'],
    //     onCodeScanned: (codes) => {
    //       console.log(`Scanned ${codes[0].value} codes!`)
    //     }
    //   })

    return (
        <View style={StyleSheet.absoluteFill}>



            {/* <Button title={'Processar'} onPress={processImage} /> */}

            <Camera
                ref={cameraRef}
                style={showCam && StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                onInitialized={onCameraInitialized}
                pixelFormat="yuv"
                photo={true} // Importante para habilitar o modo de captura de foto
            // frameProcessor={frameProcessor}
            // codeScanner={codeScanner} 
            />
            {processedPhoto && (
                <>
                    <Image style={{ width: '100%', height: '90%' }} source={{ uri: processedPhoto }} resizeMode="contain" />
                </>
            )}
            <Button title={photoUri ? 'Refazer' : 'Capturar'} onPress={takePhoto} />
            {/* <View style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'row'
            }}>
                <Button title={'MENOS'} onPress={() => setThresholdValue(thresholdValue - 10)} />
                <Button title={'MAIS'} onPress={() => setThresholdValue(thresholdValue + 10)} />

            </View> */}
        </View>
    );
};

export default CamScreen;