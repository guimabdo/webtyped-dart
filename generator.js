function generator(abstractions){
    //Path and contents =>  { path: '', contents: '' }
    let result = [];
    for(let a of abstractions){
        let path = createPath(a.path);
        let content;

        
        switch(a.kind){
            case 'Service':
                content = createServiceContent(a);
                break;
            case 'Model':
                content = createModelContent(a);
                break;
            case 'Enum':
                content = createEnumContent(a);
                break;
        }

        let f = { path: path, content: content };
        result.push(f);
    }

    return result;
}

function createPath(path){
    path = path.replace(/[\.\-]/g, '_');
    path = path.replace(/\.?([A-Z])/g, function (x,y){return "_" + y.toLowerCase()}).replace(/^_/, "");
    path += '.dart';
    return path;
}

function createServiceContent(a){
    let content = '';
    return content;
}

function createModelContent(a){
    let content = '';
    return content;
}

function createEnumContent(a){
    let content = '';
    return content;
}

module.exports = generator;