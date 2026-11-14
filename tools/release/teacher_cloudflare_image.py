"""Bounded OCI validation and daemon-free upload support for the release gate.

No network action occurs merely by importing or validating an archive.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tarfile


class ImageError(RuntimeError):
    pass


def require(value, code):
    if not value: raise ImageError(code)


def hash_file(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):h.update(chunk)
    return h.hexdigest()


def inspect_archive(path, *, archive_sha, archive_bytes, image_digest, source_sha, extract_to=None):
    """Only a single linux/amd64 OCI manifest, bounded files and no links.

    Every blob is checked, including source identity in the image configuration.
    We never use tar.extractall. Optional extraction is to a new private folder.
    """
    require(path.is_file() and not path.is_symlink(), 'OCI_ARCHIVE_NOT_REGULAR')
    require(type(archive_bytes) is int and 0 < archive_bytes <= 4*1024**3, 'OCI_ARCHIVE_SIZE_LIMIT')
    require(path.stat().st_size==archive_bytes and hash_file(path)==archive_sha, 'OCI_ARCHIVE_HASH_MISMATCH')
    if extract_to is not None:
        require(not extract_to.exists(), 'OCI_EXTRACTION_TARGET_EXISTS');extract_to.mkdir(mode=0o700)
    entries={};small={};total=0
    with tarfile.open(path, mode='r:*') as archive:
        for member in archive:
            name=str(PurePosixPath(member.name))
            require(not member.name.startswith('/') and '..' not in PurePosixPath(member.name).parts, 'OCI_UNSAFE_PATH')
            if member.isdir():
                require(name in ('.','blobs','blobs/sha256'), 'OCI_UNEXPECTED_DIRECTORY');continue
            require(member.isfile() and name not in entries, 'OCI_LINK_OR_DUPLICATE')
            require(name in ('index.json','oci-layout') or re.fullmatch(r'blobs/sha256/[a-f0-9]{64}',name), 'OCI_UNEXPECTED_FILE')
            total+=member.size;require(total<=4*1024**3 and len(entries)<128, 'OCI_EXPANDED_SIZE_LIMIT')
            stream=archive.extractfile(member);require(stream is not None, 'OCI_MISSING_FILE')
            h=hashlib.sha256();size=0;pieces=[]
            target=None
            if extract_to is not None:
                dest=extract_to/name;dest.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
                target=dest.open('xb');dest.chmod(0o600)
            try:
                for chunk in iter(lambda:stream.read(1024*1024),b''):
                    size+=len(chunk);h.update(chunk)
                    if member.size<=2*1024*1024:pieces.append(chunk)
                    if target is not None:target.write(chunk)
            finally:
                if target is not None:target.close()
            require(size==member.size,'OCI_TRUNCATED_FILE')
            if name.startswith('blobs/'):
                require(h.hexdigest()==name.rsplit('/',1)[1],'OCI_BLOB_HASH_MISMATCH')
            entries[name]={'size':size,'sha256':h.hexdigest()}
            if pieces:small[name]=b''.join(pieces)
    def read_json(name):
        require(name in small,'OCI_METADATA_MISSING_OR_TOO_LARGE')
        try:return json.loads(small[name])
        except (ValueError,UnicodeDecodeError):raise ImageError('OCI_INVALID_JSON') from None
    def descriptor(desc):
        require(isinstance(desc,dict) and re.fullmatch(r'sha256:[a-f0-9]{64}',desc.get('digest','')),'OCI_INVALID_DESCRIPTOR')
        require(not desc.get('urls'), 'OCI_FOREIGN_LAYER_URL_DENIED')
        name='blobs/sha256/'+desc['digest'][7:]
        require(name in entries and entries[name]['size']==desc.get('size'),'OCI_DESCRIPTOR_SIZE_MISMATCH')
        return name
    require(read_json('oci-layout')=={'imageLayoutVersion':'1.0.0'},'OCI_LAYOUT_VERSION')
    index=read_json('index.json');manifests=index.get('manifests')
    require(index.get('schemaVersion')==2 and isinstance(manifests,list) and len(manifests)==1,'OCI_SINGLE_IMAGE_REQUIRED')
    root=manifests[0];manifest_name=descriptor(root)
    require(root['digest']==image_digest,'OCI_REVIEWED_IMAGE_DIGEST_MISMATCH')
    manifest=read_json(manifest_name)
    require(manifest.get('schemaVersion')==2 and manifest.get('mediaType') in (
        'application/vnd.oci.image.manifest.v1+json','application/vnd.docker.distribution.manifest.v2+json'),'OCI_IMAGE_MANIFEST_REQUIRED')
    config_name=descriptor(manifest.get('config'));config=read_json(config_name)
    require(config.get('os')=='linux' and config.get('architecture')=='amd64','OCI_LINUX_AMD64_REQUIRED')
    require((config.get('config') or {}).get('Labels',{}).get('org.opencontainers.image.revision')==source_sha,'OCI_SOURCE_LABEL_MISMATCH')
    layers=manifest.get('layers');require(isinstance(layers,list) and 0<len(layers)<=64,'OCI_LAYER_COUNT')
    reachable={manifest_name,config_name,*[descriptor(layer) for layer in layers],'oci-layout','index.json'}
    require(set(entries)==reachable,'OCI_UNREFERENCED_BLOBS')
    return {'sourceSha':source_sha,'imageDigest':image_digest,'archiveSha256':archive_sha,
            'archiveBytes':archive_bytes,'platform':'linux/amd64','blobCount':len(entries)-2}
