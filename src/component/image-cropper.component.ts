import { Component, Input, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';

declare var Croppie: any;

@Component({
    selector: 'image-cropper',
    templateUrl: './image-cropper.component.html',
    styleUrls: ['./image-cropper.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => ImageCropperV2Component),
            multi: true
        }
    ]
})

export class ImageCropperV2Component implements ControlValueAccessor {

    @ViewChild('imageEditor') imageEditor;
    @Input('options') options = { width: 960, height: 504 };

    showImgChange = false;
    imageValue = new BehaviorSubject('');
    imgCrop: any = { data: { url: 'none' }, elements: { zoomer: { min: 0, max: 10, value: 0 } } };

    onChange: any = () => { };
    onTouched: any = () => { };

    constructor() { }

    ngAfterViewInit() {
        setTimeout(() => {
            //Initialise cropping tool
            let width = this.imageEditor.nativeElement.clientWidth > this.options.width ? this.options.width : this.imageEditor.nativeElement.clientWidth;
            let dimensions = { width: width, height: width / (this.options.width / this.options.height) };
            this.imgCrop = new Croppie(this.imageEditor.nativeElement, {
                viewport: { width: dimensions.width, height: dimensions.height, type: 'square' },
                boundary: { width: dimensions.width, height: dimensions.height },
                enableOrientation: true,
                mouseWheelZoom: 'ctrl',
                showZoomer: false
            });

            //Listen for write value
            this.imageValue.subscribe((value) => {
                this.imgCrop.bind(value);
            });

            //Listen for change events
            let updateHash = JSON.stringify({ orientation: 1, x: "0", y: "0", zoom: 1 });
            this.imageEditor.nativeElement.addEventListener('update', (event) => {
                //Generate new update hash
                let newUpdateHash = JSON.stringify({
                    orientation: event.detail.orientation,
                    x: event.detail.points[0],
                    y: event.detail.points[1],
                    zoom: event.detail.zoom,
                });

                //Check whether image has changed
                if (newUpdateHash !== updateHash) {
                    updateHash = newUpdateHash;
                    this.imgCrop.result({ type: 'base64', size: { width: this.options.width } }).then((base64) => {
                        this.onChange(base64); //Save header image value
                    });
                }
            });
        }, 1500);
    }

    writeValue(value: any): void {
        //Set image
        if (value && value !== '') {
            this.imageValue.next(
                //For Offigo images
                (value.startsWith('http') && !value.endsWith('jpg')) ? value + '.jpg' : value
            )
        }
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    uploadImg(e) {
        //Upload image
        let img = new Image();
        img.onload = () => {
            //Max widths
            let maxDimensions = {
                width: Math.ceil((this.options.width * 0.6) / 10) * 10,
                height: Math.ceil((this.options.height * 0.6) / 10) * 10,
            }

            //Check image size
            if (img.width >= maxDimensions.width && img.height >= maxDimensions.height) {
                //Bind to croppie
                let fr = new FileReader();
                fr.onload = (e) => {
                    //Declare function
                    let bindToCroppie = (file) => {
                        this.imgCrop.bind({ url: file }).then(() => {
                            //Update form value
                            this.imgCrop.result({ type: 'base64', size: { width: this.options.width } }).then((base64) => {
                                this.onChange(base64); //Save header image value
                            });
                        });
                    }

                    //Resize image?
                    if (img.width > 1200) {
                        import('blitz-resize').then((Blitz) => {
                            let resizer = Blitz.create();
                            resizer({
                                width: 1200,
                                source: (<FileReader>e.target).result,
                                outputFormat: 'jpg',
                            }).then(output => {
                                bindToCroppie(output);
                            }).catch(err => {
                                alert('An error occurred uploading your image!');
                            });
                        })
                    } else {
                        bindToCroppie((<FileReader>e.target).result);
                    }
                }
                fr.readAsDataURL(e.target.files[0]);
            } else {
                //Alert user error
                alert(`The selected image is too small, the recommended size is ${maxDimensions.width}px X ${maxDimensions.height}px`);
            }
        }

        //Listen for error
        img.onerror = () => {
            alert(!e.target.files[0].type.includes('image', '') ?
                'The selected file must be an image' :
                'An error occurred whilst uploading your image, please try again'
            );
        }

        //Set source to uploaded file
        img.src = URL.createObjectURL(e.target.files[0]);
    }
}