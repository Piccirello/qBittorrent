FROM ubuntu:18.04

ENV PATH "/usr/local/lib:${PATH}"

ENV LD_LIBRARY_PATH /usr/local/lib

RUN apt-get update && apt-get install -y \
    autoconf \
    automake \
    bsdtar \
    g++ \
    gawk \
    gdb \
    libboost-dev \
    libboost-chrono-dev \
    libboost-python-dev \
    libboost-random-dev \
    libboost-system-dev \
    libqt5svg5-dev \
    libssl-dev \
    libtool \
    make \
    pkg-config \
    qt5-default \
    qttools5-dev-tools \
    wget \
    zlib1g-dev

WORKDIR /usr/libtorrent

ENV LIBTORRENT_SRC https://github.com/arvidn/libtorrent/archive/RC_1_1.zip

# download, build, and install libtorrent
RUN wget $LIBTORRENT_SRC -O libtorrent.zip \
    && bsdtar --strip-components=1 -xf ./libtorrent.zip \
    && rm libtorrent.zip \
    && ./autotool.sh && ./configure --enable-logging --enable-disk-stats CXXFLAGS=-std=c++11 \
    && make -j$(nproc) \
    && make install

WORKDIR /usr/qbittorrent

COPY . .

# build and install qbittorrent
RUN ./configure --prefix=/usr --disable-gui \
    && make -j$(nproc) \
    && make install

RUN useradd -ms /bin/bash qbtuser

USER qbtuser

RUN mkdir -p ~/.config/qBittorrent \
    && echo "[LegalNotice]\nAccepted=true\n\n[Preferences]\nWebUI\AuthSubnetWhitelist=172.17.0.0/24\nWebUI\AuthSubnetWhitelistEnabled=true\n" > ~/.config/qBittorrent/qBittorrent.conf

ENV PORT 8080

ENTRYPOINT /usr/bin/qbittorrent-nox --webui-port="$PORT"

# TODO build works. make it so i can pass in QBITTORRENT_SRC or LIBTORRENT_SRC and it'll auto bust the cache
