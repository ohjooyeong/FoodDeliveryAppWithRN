import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import EncryptedStorage from 'react-native-encrypted-storage';
import {useSelector} from 'react-redux';
import {RootState} from './src/store/reducer';
import SplashScreen from 'react-native-splash-screen';

import Settings from './src/pages/Settings';
import Orders from './src/pages/Orders';
import Delivery from './src/pages/Delivery';
import SignIn from './src/pages/SignIn';
import SignUp from './src/pages/SignUp';
import useSocket from './src/hooks/useSocket';
import {useAppDispatch} from './src/store';
import axios, {AxiosError, AxiosResponse} from 'axios';
import {Alert} from 'react-native';
import Config from 'react-native-config';
import userSlice from './src/slices/user';
import orderSlice from './src/slices/order';
import usePermissions from './src/hooks/usePermissions';

export type LoggedInParamList = {
  Orders: undefined;
  Settings: undefined;
  Delivery: undefined;
  Complete: {orderId: string};
};

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppInner() {
  const isLoggedIn = useSelector((state: RootState) => !!state.user.email);
  const dispatch = useAppDispatch();

  const [socket, disconnect] = useSocket();

  usePermissions();

  useEffect(() => {
    axios.interceptors.response.use(
      (response: any) => response,
      async (error: any) => {
        const {
          config,
          response: {status},
        } = error;

        if (status === 419) {
          if (error.response.data.code === 'expired') {
            const originalRequest = config;
            const token = await EncryptedStorage.getItem('refreshToken');
            if (!token) {
              SplashScreen.hide();
              return;
            }
            const {data} = await axios.post(
              `${Config.API_URL}/refreshToken`,
              {},
              {
                headers: {
                  authorization: `Bearer ${token}`,
                },
              },
            );
            dispatch(userSlice.actions.setAccessToken(data.data.accessToken));
            originalRequest.headers.authorization = `Bearer ${data.data.accessToken}`;

            return axios(originalRequest);
          }
        }
        return Promise.reject(error);
      },
    );
  }, [dispatch]);

  useEffect(() => {
    const helloCallback = (data: any) => {
      console.log(data);
    };
    if (socket && isLoggedIn) {
      console.log(socket);
      socket.emit('login', 'hello');
      socket.on('hello', helloCallback);
    }

    return () => {
      if (socket) {
        socket.off('hello', helloCallback);
      }
    };
  }, [isLoggedIn, socket]);

  useEffect(() => {
    const callback = (data: any) => {
      console.log(data);
      dispatch(orderSlice.actions.addOrder(data));
    };
    if (socket && isLoggedIn) {
      socket.emit('acceptOrder', 'hello');
      socket.on('order', callback);
    }
    return () => {
      if (socket) {
        socket.off('order', callback);
      }
    };
  }, [isLoggedIn, socket, dispatch]);

  useEffect(() => {
    if (!isLoggedIn) {
      disconnect();
    }
  }, [isLoggedIn, disconnect]);

  // ??? ?????? ??? ?????? ????????? ??????????????? ??????
  useEffect(() => {
    const getTokenAndRefresh = async () => {
      try {
        const token = await EncryptedStorage.getItem('refreshToken');
        if (!token) {
          return;
        }
        const response = await axios.post(
          `${Config.API_URL}/refreshToken`,
          {},
          {
            headers: {
              authorization: `Bearer ${token}`,
            },
          },
        );
        dispatch(
          userSlice.actions.setUser({
            name: response.data.data.name,
            email: response.data.data.email,
            accessToken: response.data.data.accessToken,
          }),
        );
      } catch (error) {
        console.error(error);
        if (
          ((error as AxiosError).response as AxiosResponse)?.data.code ===
          'expired'
        ) {
          Alert.alert('??????', '?????? ????????? ????????????.');
        }
      } finally {
        // TODO: ???????????? ????????? ?????????
        SplashScreen.hide();
      }
    };
    getTokenAndRefresh();
  }, [dispatch]);

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <Tab.Navigator>
          <Tab.Screen
            name="Orders"
            component={Orders}
            options={{title: '?????? ??????'}}
          />
          <Tab.Screen
            name="Delivery"
            component={Delivery}
            options={{headerShown: false}}
          />
          <Tab.Screen
            name="Settings"
            component={Settings}
            options={{title: '??? ??????'}}
          />
        </Tab.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen
            name="SignIn"
            component={SignIn}
            options={{title: '?????????'}}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUp}
            options={{title: '????????????'}}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default AppInner;
