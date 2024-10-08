import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, Button, View, Image } from "react-native";
import {
    ColorConversionCodes,
    ContourApproximationModes,
    DataTypes,
    ObjectType,
    OpenCV,
    RetrievalModes,
    ThresholdTypes,
} from "react-native-fast-opencv";
import ImageEditor from '@react-native-community/image-editor';

import {
    useCameraDevice,
    useCameraPermission,
    useCodeScanner,
    Camera,
    useSkiaFrameProcessor,
} from "react-native-vision-camera";
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { PaintStyle, Skia } from '@shopify/react-native-skia';

const paint = Skia.Paint();
paint.setStyle(PaintStyle.Fill);
paint.setColor(Skia.Color('rgba(255, 138, 48, 0.3)'));

const CamScreen = () => {
    const [photoUri, setPhotoUri] = useState(null);
    const [processedPhoto, setProcessedPhoto] = useState(null);
    const [thresholdValue, setThresholdValue] = useState(162);
    const [canTakePhoto, setCanTakePhoto] = useState(false);
    const [canScan, setCanScan] = useState(false);
    const [loading, setLoading] = useState(false);
    const cameraRef = useRef(null);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();
    const [scannedCode, setScannedCode] = useState(null);
    const { resize } = useResizePlugin();



    const takePhoto = async () => {
        if (photoUri) {
            setCanTakePhoto(false)
            setCanScan(false)
            setPhotoUri(null);
            setProcessedPhoto(null);
            setLoading(false);
            setScannedCode(null)
        } else if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePhoto({
                    flash: 'off',
                    qualityPrioritization: 'balanced',
                });
                setPhotoUri(photo.path); // Salva a URI da imagem capturada
                // await processImage()


            } catch (error) {
                console.error("Erro ao capturar foto: ", error);
            }
        }
    };

    const handleCanTakePhoto = () => {
        setLoading(true)
        setCanTakePhoto(true)
        setCanScan(false);
        if (photoUri) {
            takePhoto()
            return
        }
        setTimeout(() => {
            takePhoto()
        }, 1200);
    }

    const handleScan = () => {
        setCanScan(true)
    }

    useEffect(() => {
        if (photoUri) {
            processImage();  // Chama o processImage apenas quando o photoUri for atualizado
        }
    }, [photoUri, thresholdValue]);

    const processImage = async () => {
        try {
            const resizedImage = await ImageResizer.createResizedImage(
                photoUri,
                1000,
                1000,
                'PNG',
                100
            );

            const imagePath = resizedImage.path;
            const fileData = await RNFS.readFile(imagePath, 'base64');

            const src = OpenCV.base64ToMat(fileData);
            const gray = OpenCV.createObject(ObjectType.Mat, 900, 900, DataTypes.CV_8U);

            OpenCV.invoke('cvtColor', src, gray, ColorConversionCodes.COLOR_BGR2GRAY);
            OpenCV.invoke(
                'threshold',
                gray,
                gray,
                thresholdValue,
                200,
                ThresholdTypes.THRESH_BINARY
            );


            // Detectar contornos
            const contours = OpenCV.createObject(ObjectType.MatVector);
            OpenCV.invoke(
                'findContours',
                gray,
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

                if (area > 1000) {
                    const rect = OpenCV.invoke('boundingRect', contour);
                    rectangles.push(OpenCV.toJSValue(rect));
                }
            }


            const rectangle = bestCut(rectangles)
            const dstResult = OpenCV.toJSValue(gray);
            OpenCV.clearBuffers();
            if (!rectangle) {
                console.warn('Contorno não identificado! Repita o processo!')
                forceRepeat();
                return
            }
            console.log('Imagem processada com sucesso');
            await cropImage(`data:image/jpeg;base64,${dstResult.base64}`, rectangle);

        } catch (error) {
            console.error('Erro ao processar a imagem:', error);
        }
    };

    const bestCut = array => {
        let bestInd = null;
        const expectedWidth = 350;
        const expectedHeight = 750;
        let currentWidth = 0
        let currentHeight = 0

        array.forEach((d, i) => {
            if ((d.width > currentWidth && d.height > currentHeight) && (d.width > expectedWidth && d.height > expectedHeight)) {
                bestInd = i
                currentWidth = d.width
                currentHeight = d.height
            }
        });
        return bestInd >= 0 ? array[bestInd] : null
    }

    const cropImage = async (base64Img, coords) => {
        try {
            // Defina as coordenadas de corte
            const marginWidth = 5; // Adicionar 20px de margem na largura
            const marginHeight = 5; // Adicionar 30px de margem na altura
            const cropData = {
                offset: {
                    x: Math.max(0, coords.x - marginWidth),
                    y: Math.max(0, coords.y - marginHeight),
                },
                size: {
                    width: coords.width + marginWidth * 2, // Adiciona a margem dos dois lados
                    height: coords.height + marginHeight * 2, // Adiciona a margem superior e inferior
                },
                format: 'png',
                includeBase64: true
            };

            // Realize o crop
            const image = await ImageEditor.cropImage(base64Img, cropData);

            setProcessedPhoto(image.uri);
            setLoading(false)
        } catch (error) {
            console.error('Erro ao cortar a imagem:', error);
        }
    };

    const forceRepeat = () => {
        setLoading(false);
        setPhotoUri(null);
        setProcessedPhoto(null);
        setCanTakePhoto(false);
    }


    if (!hasPermission) return <Text onPress={() => requestPermission()}>Sem Permissão</Text>;

    if (device == null) return <Text>Sem Câmera</Text>;

    const frameProcessor = useSkiaFrameProcessor((frame) => {
        'worklet';

        const width = frame.width / 4;
        const height = frame.height / 4;

        const resized = resize(frame, {
            scale: {
                width: width,
                height: height,
            },
            pixelFormat: 'bgr',
            dataType: 'uint8',
        });


        const src = OpenCV.frameBufferToMat(height, width, 3, resized);
        const dst = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);

        OpenCV.invoke('cvtColor', src, dst, ColorConversionCodes.COLOR_BGR2GRAY);

        OpenCV.invoke(
            'threshold',
            dst,
            dst,
            thresholdValue,
            200,
            ThresholdTypes.THRESH_BINARY
        );


        const channels = OpenCV.createObject(ObjectType.MatVector);
        OpenCV.invoke('split', dst, channels);
        const grayChannel = OpenCV.copyObjectFromVector(channels, 0)
        const contours = OpenCV.createObject(ObjectType.MatVector);
        OpenCV.invoke(
            'findContours',
            grayChannel,
            contours,
            RetrievalModes.RETR_TREE,
            ContourApproximationModes.CHAIN_APPROX_SIMPLE
        );

        const contoursMats = OpenCV.toJSValue(contours);
        const rectangles = [];

        for (let i = 0; i < contoursMats.array.length; i++) {
            const contour = OpenCV.copyObjectFromVector(contours, i);
            const { value: area } = OpenCV.invoke('contourArea', contour, false);

            if (area > 3000) {
                const contourPoints = OpenCV.invoke('boundingRect', contour);
                rectangles.push(contourPoints);
            }
        }

        frame.render();


        for (const rect of rectangles) {
            const rectangle = OpenCV.toJSValue(rect);
            frame.drawRect(
                {

                    height: rectangle.height * 4,
                    width: rectangle.width * 4,
                    x: rectangle.x * 4,
                    y: rectangle.y * 4,
                },
                paint
            );
        }
        OpenCV.clearBuffers();
    }, []);

    const codeScanner = useCodeScanner({
        codeTypes: ['code-128'],
        onCodeScanned: (codes) => {
            const code = codes[0].value; 
            if(code !== scannedCode) setScannedCode(codes[0].value);
        }
    })

    return (
        <View style={{
            ...StyleSheet.absoluteFill,
            ...(loading && canTakePhoto ? {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            } : {})
        }}>


            {/* <Button title={'Processar'} onPress={processImage} /> */}

            <Camera
                ref={cameraRef}
                style={!canTakePhoto ? StyleSheet.absoluteFill : {
                }}
                device={device}
                isActive={true}
                pixelFormat="yuv"
                photo={canTakePhoto}
                frameProcessor={canScan ? frameProcessor : undefined}
                codeScanner={!canScan && !canTakePhoto ? codeScanner : undefined}
            />

            {processedPhoto && (
                <>
                    <Image style={StyleSheet.absoluteFill} source={{ uri: processedPhoto }} resizeMode="contain" />
                </>
            )}
            {loading ? (
                <Text style={{
                    backgroundColor: 'rgb(225, 131, 48)',
                    fontSize: 25,
                    padding: 15,
                    borderRadius: 10,
                    color: '#fff'
                }}>Processando</Text>
            ) : !canScan && !photoUri ? (
                <Button title={`${scannedCode ? `${scannedCode} - ` : ''} Digitalizar`} onPress={handleScan} color={'rgb(225, 131, 48)'} />
            ) : (
                <Button title={photoUri ? 'Refazer' : 'Capturar'} onPress={handleCanTakePhoto} color={'rgb(225, 131, 48)'} />
            )}

        </View>
    );
};

export default CamScreen;